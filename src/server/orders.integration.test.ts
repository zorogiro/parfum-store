import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test for changeOrderStatus / updateAdminNote against the REAL database in
 * DATABASE_URL (use the Neon dev branch). It writes rows, so it is skipped unless
 * E2E_ALLOW_DB_WRITES=1.
 *   $env:E2E_ALLOW_DB_WRITES = "1"; npx vitest run src/server/orders.integration.test.ts
 * It creates its own category / products / orders (all named TEST) and deletes them in afterAll.
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";

const state = vi.hoisted(() => ({ ip: "10.0.0.1", revalidatedStock: 0 }));
const ADMIN = { id: "test-admin", email: "admin-test@example.com" };

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.ip }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(() => {
    state.revalidatedStock += 1;
  }),
}));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void callback() }));
vi.mock("@/server/email", () => ({ sendOrderEmails: vi.fn(async () => {}) }));
// The session is not under test here (see require-admin.test.ts): act as a fixed admin.
vi.mock("@/server/auth", () => ({ requireAdmin: vi.fn(async () => ADMIN) }));

describe.skipIf(!enabled)("changeOrderStatus (database)", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let placeOrder: typeof import("./checkout").placeOrder;
  let changeOrderStatus: typeof import("./orders").changeOrderStatus;
  let updateAdminNote: typeof import("./orders").updateAdminNote;

  const tag = randomUUID().slice(0, 8);
  const productIds: string[] = [];
  const createdKeys: string[] = [];
  let categoryId: string;
  let governorate: string;
  let ipCounter = 0;
  let phoneCounter = 0;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ placeOrder } = await import("./checkout"));
    ({ changeOrderStatus, updateAdminNote } = await import("./orders"));

    const category = await db.category.create({
      data: { name: `TEST ${tag}`, slug: `test-orders-${tag}` },
    });
    categoryId = category.id;
    governorate = (await db.shippingZone.findFirstOrThrow({ orderBy: { governorate: "asc" } }))
      .governorate;
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    try {
      // Orders first (OrderItem -> Variant is Restrict; history cascades), then products.
      await db.order.deleteMany({
        where: {
          OR: [
            { idempotencyKey: { in: createdKeys } },
            { items: { some: { variant: { productId: { in: productIds } } } } },
          ],
        },
      });
      await db.product.deleteMany({ where: { id: { in: productIds } } });
      if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    } finally {
      await db.$disconnect();
    }
  }, 60_000);

  async function makeVariant(stock: number) {
    const n = productIds.length + 1;
    const product = await db.product.create({
      data: {
        name: `TEST Produit ${tag}-${n}`,
        slug: `test-orders-${tag}-${n}`,
        categoryId,
        type: "ACCESSORY",
        variants: {
          create: {
            sku: `TEST-ORD-${tag}-${n}`,
            label: "Unique",
            price: 25_000,
            stock,
            options: {},
          },
        },
      },
      include: { variants: true },
    });
    productIds.push(product.id);
    return product.variants[0];
  }

  /** Places a real order through placeOrder (so its first history row is checked too). */
  async function orderOf(variantId: string, quantity: number) {
    ipCounter += 1;
    phoneCounter += 1;
    state.ip = `10.2.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
    const key = randomUUID();
    createdKeys.push(key);
    const result = await placeOrder({
      customerName: "Client Test Automatique",
      phone: `9${String(1000000 + phoneCounter + Math.floor(Math.random() * 8000000))}`,
      email: "",
      governorate,
      city: "Ville Test",
      address: "1 rue des tests automatiques",
      notes: "",
      website: "",
      idempotencyKey: key,
      items: [{ variantId, quantity }],
    });
    if (!result.ok) throw new Error(`placeOrder failed: ${result.code}`);
    return db.order.findUniqueOrThrow({ where: { number: result.number } });
  }

  const stockOf = async (variantId: string) =>
    (await db.variant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  const historyOf = (orderId: string) =>
    db.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    });

  it("placeOrder writes the first history row (null -> PENDING, by system)", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 1);
    const history = await historyOf(order.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "PENDING",
      changedBy: "system",
      note: null,
    });
  }, 60_000);

  it("cancels an order, restores the stock exactly once and writes the history", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 2);
    expect(await stockOf(variant.id)).toBe(3);

    const revalidatedBefore = state.revalidatedStock;
    const result = await changeOrderStatus(order.id, "CANCELLED", "  client injoignable ");
    expect(result.ok).toBe(true);
    expect(await stockOf(variant.id)).toBe(5);
    expect(state.revalidatedStock).toBeGreaterThan(revalidatedBefore); // catalog tag refreshed

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("CANCELLED");
    const history = await historyOf(order.id);
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, "PENDING"],
      ["PENDING", "CANCELLED"],
    ]);
    expect(history[1]).toMatchObject({ changedBy: ADMIN.email, note: "client injoignable" });

    // A second cancel is refused and does not touch the stock again.
    const again = await changeOrderStatus(order.id, "CANCELLED");
    expect(again.ok).toBe(false);
    expect(await stockOf(variant.id)).toBe(5);
    expect(await historyOf(order.id)).toHaveLength(2);
  }, 60_000);

  it("rejects invalid transitions and unknown input without changing stock or status", async () => {
    const variant = await makeVariant(4);
    const order = await orderOf(variant.id, 1);

    for (const to of ["SHIPPED", "DELIVERED", "RETURNED", "PENDING"]) {
      const result = await changeOrderStatus(order.id, to);
      expect(result.ok, to).toBe(false);
    }
    expect((await changeOrderStatus(order.id, "NOPE")).ok).toBe(false);
    expect((await changeOrderStatus("does-not-exist", "CONFIRMED")).ok).toBe(false);

    expect(await stockOf(variant.id)).toBe(3);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await historyOf(order.id)).toHaveLength(1);
  }, 60_000);

  it("walks PENDING -> CONFIRMED -> SHIPPED -> DELIVERED without touching the stock", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 1);
    for (const to of ["CONFIRMED", "SHIPPED", "DELIVERED"]) {
      expect((await changeOrderStatus(order.id, to)).ok, to).toBe(true);
    }
    expect(await stockOf(variant.id)).toBe(4);
    const history = await historyOf(order.id);
    expect(history.map((h) => h.toStatus)).toEqual([
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ]);
    // DELIVERED is final.
    for (const to of ["CANCELLED", "RETURNED", "SHIPPED"]) {
      expect((await changeOrderStatus(order.id, to)).ok, to).toBe(false);
    }
    expect(await stockOf(variant.id)).toBe(4);
  }, 60_000);

  it("RETURNED after SHIPPED restores the stock, once", async () => {
    const variant = await makeVariant(6);
    const order = await orderOf(variant.id, 3);
    expect(await stockOf(variant.id)).toBe(3);
    expect((await changeOrderStatus(order.id, "CONFIRMED")).ok).toBe(true);
    expect((await changeOrderStatus(order.id, "SHIPPED")).ok).toBe(true);
    expect(await stockOf(variant.id)).toBe(3);
    expect((await changeOrderStatus(order.id, "RETURNED")).ok).toBe(true);
    expect(await stockOf(variant.id)).toBe(6);
    expect((await changeOrderStatus(order.id, "RETURNED")).ok).toBe(false);
    expect((await changeOrderStatus(order.id, "CANCELLED")).ok).toBe(false);
    expect(await stockOf(variant.id)).toBe(6);
  }, 60_000);

  it("cancelling a CONFIRMED order restores the stock too", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 2);
    expect((await changeOrderStatus(order.id, "CONFIRMED")).ok).toBe(true);
    expect((await changeOrderStatus(order.id, "CANCELLED")).ok).toBe(true);
    expect(await stockOf(variant.id)).toBe(5);
  }, 60_000);

  it("two concurrent calls (CANCELLED and CONFIRMED) leave a consistent state, stock restored at most once", async () => {
    // Repeated so both interleavings (CONFIRMED first, CANCELLED first) get exercised.
    for (let round = 0; round < 4; round++) {
      const variant = await makeVariant(5);
      const order = await orderOf(variant.id, 2);

      const [cancel, confirm] = await Promise.all([
        changeOrderStatus(order.id, "CANCELLED"),
        changeOrderStatus(order.id, "CONFIRMED"),
      ]);

      // CANCELLED always succeeds: valid from PENDING and from CONFIRMED.
      expect(cancel.ok).toBe(true);
      const final = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(final.status).toBe("CANCELLED");
      expect(await stockOf(variant.id)).toBe(5); // restored exactly once

      // The history is a consistent chain that ends at the final status.
      const history = await historyOf(order.id);
      history.slice(1).forEach((h, i) => expect(h.fromStatus).toBe(history[i].toStatus));
      expect(history.at(-1)!.toStatus).toBe("CANCELLED");
      expect(history).toHaveLength(confirm.ok ? 3 : 2);
    }
  }, 120_000);

  it("two concurrent cancels restore the stock only once", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 2);
    const results = await Promise.all([
      changeOrderStatus(order.id, "CANCELLED"),
      changeOrderStatus(order.id, "CANCELLED"),
      changeOrderStatus(order.id, "CANCELLED"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(5);
    expect(await historyOf(order.id)).toHaveLength(2);
  }, 60_000);

  it("saves, trims and clears the internal note (1000 characters maximum)", async () => {
    const variant = await makeVariant(5);
    const order = await orderOf(variant.id, 1);

    expect((await updateAdminNote(order.id, "  Rappeler après 18 h ")).ok).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).adminNote).toBe(
      "Rappeler après 18 h",
    );
    expect((await updateAdminNote(order.id, "x".repeat(1001))).ok).toBe(false);
    expect((await updateAdminNote(order.id, "")).ok).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).adminNote).toBeNull();
    expect((await updateAdminNote("does-not-exist", "x")).ok).toBe(false);
  }, 60_000);
});
