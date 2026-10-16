import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { formatTND } from "../src/lib/money";
import { FAKE_NAME, closeDb, deleteTestOrders, sql, writesAllowed } from "./helpers/db";

/**
 * WRITING spec for the admin order management: logs in as the seeded admin (ADMIN_EMAIL and
 * ADMIN_PASSWORD from the environment, never printed), confirms / ships / delivers / cancels
 * TEST orders, checks history, stock, the print page and the CSV export. It writes to the
 * database named by DATABASE_URL (Neon dev branch only), so it needs E2E_ALLOW_DB_WRITES=1.
 * Every order it creates is named "TEST E2E Client"; they are deleted afterwards and the stock
 * of the seeded product is restored.
 *   $env:E2E_ALLOW_DB_WRITES = "1"; npm run test:e2e -- admin-orders
 */
test.skip(!writesAllowed, "Writing e2e spec: set E2E_ALLOW_DB_WRITES=1 (dev database only).");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CART_KEY = "parfum-store.cart.v1";
const LABEL = "L / Blanc";
// A formula in a customer-controlled field: the CSV export must neutralize it.
const EVIL_NOTE = '=HYPERLINK("http://example.invalid";"clic")';

let variantId = "";
const originalStock = new Map<string, number>();
let ipCounter = Math.floor(Math.random() * 200) + 1;

const stockNow = async () =>
  (await sql().query(`SELECT stock FROM "Variant" WHERE id = $1`, [variantId])).rows[0]
    .stock as number;

async function restoreStock() {
  for (const [id, stock] of originalStock) {
    await sql().query(`UPDATE "Variant" SET stock = $1 WHERE id = $2`, [stock, id]);
  }
}

test.beforeAll(async () => {
  const { rows } = await sql().query(
    `SELECT v.id, v.label, v.stock FROM "Variant" v JOIN "Product" p ON p.id = v."productId"
     WHERE p.slug = 't-shirt-coton-premium'`,
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) originalStock.set(r.id, r.stock);
  variantId = rows.find((r) => r.label === LABEL)!.id;
});

test.afterAll(async () => {
  try {
    await deleteTestOrders();
    await restoreStock();
  } finally {
    await closeDb();
  }
});

test.beforeEach(async () => {
  await deleteTestOrders();
  await restoreStock();
});

async function login(page: Page) {
  expect(ADMIN_EMAIL, "ADMIN_EMAIL must be set in the environment").toBeTruthy();
  expect(ADMIN_PASSWORD, "ADMIN_PASSWORD must be set in the environment").toBeTruthy();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL!);
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Inserts a PENDING TEST order (quantity 1 of the seeded variant) and takes the stock. */
async function insertTestOrder() {
  const number = `ORD-T${randomBytes(4).toString("hex").toUpperCase()}`;
  const id = `test${randomUUID().replaceAll("-", "")}`;
  const db = sql();
  const { rows } = await db.query(`SELECT price FROM "Variant" WHERE id = $1`, [variantId]);
  const price = rows[0].price as number;
  await db.query(`UPDATE "Variant" SET stock = stock - 1 WHERE id = $1`, [variantId]);
  await db.query(
    `INSERT INTO "Order" (id, number, "trackingToken", status, "customerName", phone, governorate, city, address, notes,
                          subtotal, "shippingFee", total, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PENDING', $4, '+21620000009', 'Tunis', 'Ville Test', '1 rue des tests automatiques', $5,
             $6, 8000, $7, now(), now())`,
    [id, number, randomBytes(32).toString("base64url"), FAKE_NAME, EVIL_NOTE, price, price + 8000],
  );
  await db.query(
    `INSERT INTO "OrderItem" (id, "orderId", "variantId", "productName", "variantLabel", "unitPrice", quantity)
     VALUES ($1, $2, $3, 'T-shirt coton premium', $4, $5, 1)`,
    [`testi${randomUUID().replaceAll("-", "")}`, id, variantId, LABEL, price],
  );
  await db.query(
    `INSERT INTO "OrderStatusHistory" (id, "orderId", "fromStatus", "toStatus", "changedBy")
     VALUES ($1, $2, NULL, 'PENDING', 'system')`,
    [`testh${randomUUID().replaceAll("-", "")}`, id],
  );
  return { id, number, total: price + 8000 };
}

async function openFromList(page: Page, number: string) {
  await page.goto(`/admin/orders?q=${number}`);
  await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
  // Desktop table and phone cards both render a link; the visible one is clicked.
  await page
    .getByRole("link", { name: new RegExp(number) })
    .locator("visible=true")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: `Commande ${number}` })).toBeVisible();
}

async function applyStatus(page: Page, buttonName: string, note?: string) {
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  if (note) await dialog.getByLabel("Note (facultatif)").fill(note);
  await dialog.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(dialog).toBeHidden();
}

const statusLine = (page: Page, label: string) =>
  page.getByText("Statut actuel :").locator("..").getByText(label, { exact: true });

test("admin: list, confirm, history, cancel restores stock, print page, CSV export", async ({
  page,
}) => {
  const order = await insertTestOrder();
  const startStock = originalStock.get(variantId)!;
  expect(await stockNow()).toBe(startStock - 1);

  await login(page);
  await openFromList(page, order.number);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(statusLine(page, "En attente")).toBeVisible();
  await expect(page.getByText(formatTND(order.total)).first()).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\d+\?text=/,
  );
  // PENDING offers exactly confirm and cancel.
  await expect(page.getByRole("button", { name: "Confirmer la commande" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler la commande" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme expédiée" })).toHaveCount(0);

  // Confirm, with a note.
  await applyStatus(page, "Confirmer la commande", "client joint par téléphone");
  await expect(statusLine(page, "Confirmée")).toBeVisible();
  await expect(page.getByText("En attente → Confirmée")).toBeVisible();
  await expect(page.getByText("client joint par téléphone")).toBeVisible();
  expect(await stockNow()).toBe(startStock - 1); // confirming does not touch the stock

  // Internal note.
  await page.getByLabel("Note interne").fill("rappeler avant 18 h");
  await page.getByRole("button", { name: "Enregistrer la note" }).click();
  await expect(page.getByText("Note enregistrée.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Note interne")).toHaveValue("rappeler avant 18 h");

  // Cancel: the dialog warns that the stock will be restored.
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Le stock des articles");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmer", exact: true })
    .click();
  await expect(statusLine(page, "Annulée")).toBeVisible();
  await expect(page.getByText("Confirmée → Annulée")).toBeVisible();
  await expect(page.getByText("Ce statut est définitif")).toBeVisible();
  expect(await stockNow()).toBe(startStock); // restored, exactly once

  // Print page: no admin chrome, amount to collect, print button hidden when printing.
  await page.goto(`/admin/orders/${order.id}/print`);
  await expect(page.getByText(`Commande ${order.number}`)).toBeVisible();
  await expect(page.getByText("Montant à encaisser")).toBeVisible();
  await expect(page.getByText(formatTND(order.total)).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Déconnexion" })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // CSV export honours the filters, starts with a BOM and neutralizes the formula.
  const response = await page.request.get(`/admin/orders/export?q=${order.number}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const body = await response.body();
  expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = body.toString("utf8");
  expect(csv).toContain(order.number);
  expect(csv).toContain("Annulée");
  expect(csv).toContain("'=HYPERLINK"); // quote-prefixed
  expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2); // header + the filtered order
  expect(csv).toContain((order.total / 1000).toFixed(3));

  // A status filter that excludes the order leaves only the header.
  const none = await page.request.get(`/admin/orders/export?q=${order.number}&status=PENDING`);
  expect((await none.text()).split("\r\n").filter(Boolean)).toHaveLength(1);
});

test("admin: a real storefront order goes confirmed -> shipped -> delivered", async ({ page }) => {
  ipCounter += 1;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${ipCounter}` });
  const startStock = originalStock.get(variantId)!;

  // Storefront checkout (cart seeded straight into localStorage).
  await page.goto("/");
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
  await page.evaluate(
    ([key, id]) => localStorage.setItem(key, JSON.stringify([{ variantId: id, quantity: 1 }])),
    [CART_KEY, variantId] as const,
  );
  await page.goto("/checkout");
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
  await page.getByLabel("Nom complet").fill(FAKE_NAME);
  await page.getByLabel("Téléphone", { exact: true }).fill("20 000 002");
  await page.getByLabel("Gouvernorat").selectOption({ index: 1 });
  await page.getByLabel("Ville / délégation").fill("Ville Test");
  await page.getByLabel("Adresse complète").fill("1 rue des tests automatiques");
  await page.getByTestId("checkout-submit").click();
  await expect(page).toHaveURL(/\/order\/confirmation\?number=ORD-\d+/);
  const number = (await page.getByTestId("order-number").textContent())!.trim();
  expect(await stockNow()).toBe(startStock - 1);

  // The order has its creation history row.
  const created = await sql().query(
    `SELECT h."fromStatus", h."toStatus", h."changedBy" FROM "OrderStatusHistory" h
     JOIN "Order" o ON o.id = h."orderId" WHERE o.number = $1`,
    [number],
  );
  expect(created.rows).toEqual([{ fromStatus: null, toStatus: "PENDING", changedBy: "system" }]);

  await login(page);
  await openFromList(page, number);
  await applyStatus(page, "Confirmer la commande");
  await expect(statusLine(page, "Confirmée")).toBeVisible();
  await applyStatus(page, "Marquer comme expédiée");
  await expect(statusLine(page, "Expédiée")).toBeVisible();
  await applyStatus(page, "Marquer comme livrée");
  await expect(statusLine(page, "Livrée")).toBeVisible();
  await expect(page.getByText("Ce statut est définitif")).toBeVisible();
  expect(await stockNow()).toBe(startStock - 1); // delivered: stock stays sold

  const history = await sql().query(
    `SELECT h."toStatus" FROM "OrderStatusHistory" h JOIN "Order" o ON o.id = h."orderId"
     WHERE o.number = $1 ORDER BY h."changedAt", h.id`,
    [number],
  );
  expect(history.rows.map((r) => r.toStatus)).toEqual([
    "PENDING",
    "CONFIRMED",
    "SHIPPED",
    "DELIVERED",
  ]);

  // Dashboard revenue (month of delivery) matches an independent SQL computation.
  const revenue = await sql().query(
    `SELECT COALESCE(SUM(o.total), 0)::int AS revenue FROM "Order" o
     JOIN "OrderStatusHistory" h ON h."orderId" = o.id
     WHERE o.status = 'DELIVERED' AND h."toStatus" = 'DELIVERED'
       AND h."changedAt" >= (date_trunc('month', now() AT TIME ZONE 'Africa/Tunis') AT TIME ZONE 'Africa/Tunis')
       AND h."changedAt" < ((date_trunc('month', now() AT TIME ZONE 'Africa/Tunis') + interval '1 month') AT TIME ZONE 'Africa/Tunis')`,
  );
  await page.goto("/admin");
  await expect(page.getByText("Chiffre d'affaires du mois")).toBeVisible();
  await expect(page.getByText(formatTND(revenue.rows[0].revenue as number)).first()).toBeVisible();
  await expect(page.getByText("Commandes aujourd'hui")).toBeVisible();
  await expect(page.getByText("Stock faible", { exact: true })).toBeVisible();
});

test("admin: shipping and settings pages validate and save (values restored)", async ({ page }) => {
  const zone = (
    await sql().query(
      `SELECT id, governorate, fee FROM "ShippingZone" ORDER BY governorate LIMIT 1`,
    )
  ).rows[0];
  const threshold = (
    await sql().query(`SELECT value FROM "Setting" WHERE key = 'freeShippingThreshold'`)
  ).rows[0]?.value as string | undefined;
  const settings = (
    await sql().query(
      `SELECT key, value FROM "Setting" WHERE key IN ('storePhone','notificationEmail')`,
    )
  ).rows as { key: string; value: string }[];
  try {
    await login(page);

    // Shipping: an invalid fee is refused, a valid one is saved.
    await page.goto("/admin/shipping");
    const feeInput = page.getByLabel(new RegExp(`Frais \\(TND\\) – ${zone.governorate}`));
    await feeInput.fill("150");
    await page.getByRole("button", { name: "Enregistrer les frais" }).click();
    await expect(page.getByText("Frais invalides (entre 0 et 100 TND).")).toBeVisible();
    expect(
      (await sql().query(`SELECT fee FROM "ShippingZone" WHERE id = $1`, [zone.id])).rows[0].fee,
    ).toBe(zone.fee);

    await feeInput.fill("9.250");
    await page.getByRole("button", { name: "Enregistrer les frais" }).click();
    await expect(page.getByText("Frais de livraison enregistrés.")).toBeVisible();
    expect(
      (await sql().query(`SELECT fee FROM "ShippingZone" WHERE id = $1`, [zone.id])).rows[0].fee,
    ).toBe(9250);

    // Settings: an invalid phone is refused, a valid one is stored as +216XXXXXXXX.
    await page.goto("/admin/settings");
    await page.getByLabel("Téléphone de la boutique").fill("123");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText(/Numéro invalide/)).toBeVisible();
    await page.getByLabel("Téléphone de la boutique").fill("71 123 456");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
    expect(
      (await sql().query(`SELECT value FROM "Setting" WHERE key = 'storePhone'`)).rows[0].value,
    ).toBe("+21671123456");
  } finally {
    await sql().query(`UPDATE "ShippingZone" SET fee = $1 WHERE id = $2`, [zone.fee, zone.id]);
    if (threshold !== undefined) {
      await sql().query(`UPDATE "Setting" SET value = $1 WHERE key = 'freeShippingThreshold'`, [
        threshold,
      ]);
    }
    for (const s of settings) {
      await sql().query(`UPDATE "Setting" SET value = $1 WHERE key = $2`, [s.value, s.key]);
    }
  }
});

test("admin: order list and detail fit a 390px phone screen", async ({ page }) => {
  const order = await insertTestOrder();
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  const fits = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  await page.goto("/admin");
  expect(await fits()).toBe(true);
  await page.goto(`/admin/orders?q=${order.number}`);
  await expect(
    page
      .getByRole("link", { name: new RegExp(order.number) })
      .locator("visible=true")
      .first(),
  ).toBeVisible();
  expect(await fits()).toBe(true);

  await page.goto(`/admin/orders/${order.id}`);
  await expect(page.getByRole("button", { name: "Confirmer la commande" })).toBeVisible();
  expect(await fits()).toBe(true);
  const box = await page.getByRole("button", { name: "Confirmer la commande" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(36);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);

  await page.goto("/admin/shipping");
  expect(await fits()).toBe(true);
  await page.goto("/admin/settings");
  expect(await fits()).toBe(true);
});
