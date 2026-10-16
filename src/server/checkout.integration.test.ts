import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test for placeOrder against the REAL database in DATABASE_URL (use the dev
 * branch). It writes rows, so it is skipped unless E2E_ALLOW_DB_WRITES=1.
 *   $env:E2E_ALLOW_DB_WRITES = "1"; npx vitest run src/server/checkout.integration.test.ts
 * It creates its own category / products / orders and deletes them in afterAll, even on failure.
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";

const state = vi.hoisted(() => ({ ip: "10.0.0.1" }));

// Next.js request APIs do not exist outside a request: replace them with minimal fakes.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.ip }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void callback() }));
// Never send real emails from a test.
vi.mock("@/server/email", () => ({ sendOrderEmails: vi.fn(async () => {}) }));

describe.skipIf(!enabled)("placeOrder (database)", () => {
  type Db = typeof import("@/lib/db").db;
  type PlaceOrder = typeof import("./checkout").placeOrder;
  let db: Db;
  let placeOrder: PlaceOrder;
  let pricing: typeof import("@/lib/pricing");
  let cartDetails: typeof import("@/lib/cart-details");

  const tag = randomUUID().slice(0, 8);
  const productIds: string[] = [];
  const createdKeys: string[] = [];
  let categoryId: string;
  let governorate: string;
  let zoneFee: number;
  let threshold: number | null;
  let ipCounter = 0;
  let phoneCounter = 0;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ placeOrder } = await import("./checkout"));
    pricing = await import("@/lib/pricing");
    cartDetails = await import("@/lib/cart-details");

    const category = await db.category.create({
      data: { name: `TEST ${tag}`, slug: `test-checkout-${tag}` },
    });
    categoryId = category.id;

    const zone = await db.shippingZone.findFirstOrThrow({ orderBy: { governorate: "asc" } });
    governorate = zone.governorate;
    zoneFee = zone.fee;
    const setting = await db.setting.findUnique({ where: { key: "freeShippingThreshold" } });
    threshold = cartDetails.parseThresholdSetting(setting?.value);
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    try {
      // Orders first (OrderItem -> Variant is Restrict), then products (variants cascade).
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

  async function makeVariant(opts: {
    stock: number;
    price: number;
    name?: string;
    label?: string;
  }) {
    const n = productIds.length + 1;
    const product = await db.product.create({
      data: {
        name: opts.name ?? `TEST Produit ${tag}-${n}`,
        slug: `test-checkout-${tag}-${n}`,
        categoryId,
        type: "ACCESSORY",
        variants: {
          create: {
            sku: `TEST-${tag}-${n}`,
            label: opts.label ?? "Unique",
            price: opts.price,
            stock: opts.stock,
            options: {},
          },
        },
      },
      include: { variants: true },
    });
    productIds.push(product.id);
    return { product, variant: product.variants[0] };
  }

  /** Each call comes from its own fake IP and phone so the rate limits never interfere. */
  function payload(variantId: string, quantity: number, overrides: Record<string, unknown> = {}) {
    phoneCounter += 1;
    const key = randomUUID();
    createdKeys.push(key);
    return {
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
      ...overrides,
    };
  }

  async function place(input: ReturnType<typeof payload>) {
    ipCounter += 1;
    state.ip = `10.1.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
    return placeOrder(input);
  }

  it("two concurrent orders for the last unit: exactly one succeeds, stock ends at 0", async () => {
    const { variant } = await makeVariant({ stock: 1, price: 50_000 });
    const a = payload(variant.id, 1);
    const b = payload(variant.id, 1);
    state.ip = "10.9.0.1";
    const [ra, rb] = await Promise.all([placeOrder(a), placeOrder(b)]);

    const results = [ra, rb];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok)!;
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("STOCK_CONFLICT");
      expect(failed.conflicts).toEqual([{ variantId: variant.id, available: 0 }]);
    }

    const after = await db.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(0);
    expect(await db.orderItem.count({ where: { variantId: variant.id } })).toBe(1);
  }, 60_000);

  it("reports the current availability and does not reduce quantities silently", async () => {
    const { variant } = await makeVariant({ stock: 2, price: 50_000 });
    const result = await place(payload(variant.id, 3));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STOCK_CONFLICT");
      expect(result.conflicts).toEqual([{ variantId: variant.id, available: 2 }]);
    }
    const after = await db.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(2); // nothing decremented
    expect(await db.orderItem.count({ where: { variantId: variant.id } })).toBe(0);
  }, 60_000);

  it("rolls back every line when one of several lines conflicts", async () => {
    const ok = await makeVariant({ stock: 5, price: 10_000 });
    const low = await makeVariant({ stock: 1, price: 10_000 });
    const input = payload(ok.variant.id, 2);
    input.items = [
      { variantId: ok.variant.id, quantity: 2 },
      { variantId: low.variant.id, quantity: 4 },
    ];
    const result = await place(input);
    expect(result.ok).toBe(false);
    expect((await db.variant.findUniqueOrThrow({ where: { id: ok.variant.id } })).stock).toBe(5);
  }, 60_000);

  it("rejects inactive products and unknown variants as unavailable", async () => {
    const { product, variant } = await makeVariant({ stock: 5, price: 10_000 });
    await db.product.update({ where: { id: product.id }, data: { isActive: false } });
    const result = await place(payload(variant.id, 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflicts).toEqual([{ variantId: variant.id, available: 0 }]);

    const unknown = await place(payload("doesnotexist", 1));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("STOCK_CONFLICT");
  }, 60_000);

  it("is idempotent: the same key twice (sequential and concurrent) creates one order", async () => {
    const { variant } = await makeVariant({ stock: 5, price: 20_000 });
    const input = payload(variant.id, 1);

    const first = await place(input);
    const second = await place(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.number).toBe(first.number);
      expect(second.token).toBe(first.token);
    }

    const racing = payload(variant.id, 1);
    state.ip = "10.9.0.2";
    const [r1, r2, r3] = await Promise.all([
      placeOrder(racing),
      placeOrder(racing),
      placeOrder(racing),
    ]);
    expect(r1.ok && r2.ok && r3.ok).toBe(true);
    if (r1.ok && r2.ok && r3.ok) {
      expect(new Set([r1.number, r2.number, r3.number]).size).toBe(1);
    }

    expect(await db.orderItem.count({ where: { variantId: variant.id } })).toBe(2);
    expect((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(3);
  }, 60_000);

  it("a retry of the last unit with the same key returns the order, not a stock conflict", async () => {
    const { variant } = await makeVariant({ stock: 1, price: 20_000 });
    const input = payload(variant.id, 1);
    const first = await place(input);
    const retry = await place(input);
    expect(first.ok && retry.ok).toBe(true);
    if (first.ok && retry.ok) expect(retry.number).toBe(first.number);
  }, 60_000);

  it("totals match pricing.ts, with free shipping exactly at the threshold", async () => {
    const price = threshold ?? 50_000;
    const { variant } = await makeVariant({ stock: 10, price });
    const result = await place(payload(variant.id, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await db.order.findUniqueOrThrow({ where: { number: result.number } });
    const expected = pricing.calculateTotal({
      subtotal: pricing.calculateSubtotal([{ unitPrice: price, quantity: 1 }]),
      zoneFee: zoneFee,
      freeShippingThreshold: threshold,
    });
    expect({
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
    }).toEqual(expected);
    if (threshold) expect(order.shippingFee).toBe(0); // subtotal === threshold counts as free
    expect(order.total).toBe(order.subtotal + order.shippingFee);
  }, 60_000);

  it("charges the zone fee just below the threshold", async () => {
    const price = threshold ? threshold - 1 : 1_000;
    const { variant } = await makeVariant({ stock: 10, price });
    const result = await place(payload(variant.id, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await db.order.findUniqueOrThrow({ where: { number: result.number } });
    expect(order.shippingFee).toBe(zoneFee);
    expect(order.total).toBe(price + zoneFee);
  }, 60_000);

  it("computes multi-line, multi-quantity totals from database prices", async () => {
    const a = await makeVariant({ stock: 10, price: 12_345 });
    const b = await makeVariant({ stock: 10, price: 6_789 });
    const input = payload(a.variant.id, 3);
    input.items = [
      { variantId: a.variant.id, quantity: 3 },
      { variantId: b.variant.id, quantity: 2 },
    ];
    // A hostile client also sends prices: they must be ignored.
    const result = await place({ ...input, total: 1, subtotal: 1 } as typeof input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await db.order.findUniqueOrThrow({ where: { number: result.number } });
    const subtotal = 3 * 12_345 + 2 * 6_789;
    expect(order.subtotal).toBe(subtotal);
    expect(order.total).toBe(
      pricing.calculateTotal({ subtotal, zoneFee, freeShippingThreshold: threshold }).total,
    );
  }, 60_000);

  it("stores snapshots, the normalized phone, PENDING status and a strong token", async () => {
    const { product, variant } = await makeVariant({
      stock: 4,
      price: 33_000,
      name: `TEST Snapshot ${tag}`,
      label: "100 ml",
    });
    const input = payload(variant.id, 2, {
      email: "client.test@example.com",
      notes: "Sonner deux fois",
      phone: "+216 22 123 456",
    });
    const result = await place(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.number).toMatch(/^ORD-\d{6,}$/);
    expect(result.token.length).toBeGreaterThanOrEqual(32);

    // Catalog edits after the order must not change it.
    await db.variant.update({
      where: { id: variant.id },
      data: { price: 99_000, label: "changed" },
    });
    await db.product.update({ where: { id: product.id }, data: { name: "changed" } });

    const order = await db.order.findUniqueOrThrow({
      where: { number: result.number },
      include: { items: true },
    });
    expect(order.status).toBe("PENDING");
    expect(order.phone).toBe("+21622123456");
    expect(order.email).toBe("client.test@example.com");
    expect(order.notes).toBe("Sonner deux fois");
    expect(order.governorate).toBe(governorate);
    expect(order.trackingToken).toBe(result.token);
    expect(order.idempotencyKey).toBe(input.idempotencyKey);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      variantId: variant.id,
      productName: `TEST Snapshot ${tag}`,
      variantLabel: "100 ml",
      unitPrice: 33_000,
      quantity: 2,
    });
    expect((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(2);
  }, 60_000);

  it("does not create an order for a filled honeypot or an unknown governorate", async () => {
    const { variant } = await makeVariant({ stock: 3, price: 10_000 });
    const bot = await place(payload(variant.id, 1, { website: "http://spam.example" }));
    expect(bot.ok).toBe(false);
    const nowhere = await place(payload(variant.id, 1, { governorate: "Atlantide" }));
    expect(nowhere.ok).toBe(false);
    if (!nowhere.ok) expect(nowhere.fieldErrors?.governorate).toBeTruthy();
    expect(await db.orderItem.count({ where: { variantId: variant.id } })).toBe(0);
    expect((await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(3);
  }, 60_000);

  it("limits orders per IP (6th order from the same IP in an hour is refused)", async () => {
    const { variant } = await makeVariant({ stock: 20, price: 1_000 });
    state.ip = "10.77.0.1";
    const outcomes = [];
    for (let i = 0; i < 6; i++) outcomes.push(await placeOrder(payload(variant.id, 1)));
    expect(outcomes.slice(0, 5).every((r) => r.ok)).toBe(true);
    const sixth = outcomes[5];
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.code).toBe("RATE_LIMITED");
  }, 120_000);
});
