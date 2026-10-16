import { expect, test, type Page } from "@playwright/test";
import {
  FAKE_NAME,
  closeDb,
  countTestOrdersByPhone,
  deleteTestOrders,
  sql,
  writesAllowed,
} from "./helpers/db";

/**
 * WRITING spec: creates real orders and changes stock in the database named by DATABASE_URL
 * (use the Neon dev branch). It refuses to run unless E2E_ALLOW_DB_WRITES=1, and it deletes
 * its orders and restores the stock of the seeded product it uses afterwards.
 *   $env:E2E_ALLOW_DB_WRITES = "1"; npm run test:e2e -- checkout.write
 * Customers are clearly fake (name "TEST E2E Client", phones 2000000x).
 */
test.skip(!writesAllowed, "Writing e2e spec: set E2E_ALLOW_DB_WRITES=1 (dev database only).");

const PRODUCT = "/p/t-shirt-coton-premium";
const CART_KEY = "parfum-store.cart.v1";
const LABEL = "L / Blanc";

let variantId = "";
const originalStock = new Map<string, number>();

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
  // Clean slate for every test: no leftover orders, stock back to the seed values.
  await deleteTestOrders();
  await restoreStock();
});

let ipCounter = Math.floor(Math.random() * 200) + 1;
/** A distinct fake client IP per test, so the in-memory 5-orders-per-hour limit never interferes. */
async function useFakeIp(page: Page) {
  ipCounter += 1;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${ipCounter}` });
}

async function hydrated(page: Page) {
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
}

/** Puts `quantity` of the test variant in the cart without going through the UI. */
async function seedCart(page: Page, quantity: number) {
  await page.goto("/");
  await hydrated(page);
  await page.evaluate(
    ([key, id, q]) => localStorage.setItem(key, JSON.stringify([{ variantId: id, quantity: q }])),
    [CART_KEY, variantId, quantity] as const,
  );
}

async function fillCheckout(page: Page, phone: string) {
  await page.getByLabel("Nom complet").fill(FAKE_NAME);
  await page.getByLabel("Téléphone", { exact: true }).fill(phone);
  await page.getByLabel("Gouvernorat").selectOption({ index: 1 });
  await page.getByLabel("Ville / délégation").fill("Ville Test");
  await page.getByLabel("Adresse complète").fill("1 rue des tests automatiques");
}

const submit = (page: Page) => page.getByTestId("checkout-submit");

test("add to cart, checkout, confirmation, tracking", async ({ page }) => {
  await useFakeIp(page);

  // Add to the cart through the product page.
  await page.goto(PRODUCT);
  await hydrated(page);
  await page
    .getByRole("radiogroup", { name: /couleur/i })
    .getByRole("radio", { name: "Blanc" })
    .click();
  await page
    .getByRole("radiogroup", { name: /taille/i })
    .getByRole("radio", { name: "L", exact: true })
    .click();
  await page.getByRole("button", { name: "Augmenter la quantité" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await expect(page.getByTestId("cart-badge")).toHaveText("2");

  await page.goto("/cart");
  await hydrated(page);
  await page.getByRole("link", { name: "Commander" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await hydrated(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // Summary: 2 x 35,000 = 70,000; shipping pending until a governorate is chosen.
  await expect(page.getByTestId("checkout-subtotal")).toHaveText("70,000 TND");
  await expect(page.getByTestId("checkout-shipping")).toHaveText("Choisissez un gouvernorat");
  await expect(submit(page)).toBeEnabled();

  // Inline errors on an empty submit.
  await submit(page).click();
  await expect(page.getByText("Indiquez votre nom (2 à 80 caractères).")).toBeVisible();
  await expect(page.getByText(/Numéro de téléphone invalide/)).toBeVisible();

  await fillCheckout(page, "20 000 001");
  await expect(page.getByTestId("checkout-shipping")).toHaveText(/\d+,\d{3} TND/);
  await expect(page.getByTestId("checkout-total")).toHaveText(/\d[\d ]*,\d{3} TND/);
  await submit(page).click();

  await expect(page).toHaveURL(/\/order\/confirmation\?number=ORD-\d+&token=[\w-]{32,}/);
  const number = (await page.getByTestId("order-number").textContent())!.trim();
  expect(number).toMatch(/^ORD-\d{6,}$/);
  await expect(page.getByTestId("call-message")).toContainText("Nous allons vous appeler");
  await expect(page.getByRole("link", { name: "Suivre ma commande" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // The cart was cleared only after success.
  await expect(page.getByTestId("cart-badge")).toHaveText("0");

  // Stock decremented by 2 (read straight from the database).
  const { rows } = await sql().query(`SELECT stock FROM "Variant" WHERE id = $1`, [variantId]);
  expect(rows[0].stock).toBe(originalStock.get(variantId)! - 2);

  // Wrong token / no token: real 404, and the order data does not leak.
  const confirmationUrl = page.url();
  const wrong = await page.goto(confirmationUrl.replace(/token=[\w-]+/, "token=" + "a".repeat(43)));
  expect(wrong?.status()).toBe(404);
  await expect(page.getByText(FAKE_NAME)).toHaveCount(0);
  expect((await page.goto(`/order/confirmation?number=${number}`))?.status()).toBe(404);
  const ok = await page.goto(confirmationUrl);
  expect(ok?.status()).toBe(200);
  expect(ok?.headers()["cache-control"]).toMatch(/no-store/);

  // Tracking: wrong phone and unknown number give the same generic message.
  await page.goto("/suivi");
  await hydrated(page);
  await page.getByLabel("Numéro de commande").fill(number);
  await page.getByLabel("Téléphone").fill("29999999");
  await page.getByRole("button", { name: "Suivre ma commande" }).click();
  await expect(page.getByTestId("tracking-error")).toHaveText(
    "Aucune commande trouvée avec ces informations",
  );
  await page.getByLabel("Numéro de commande").fill("ORD-999999");
  await page.getByLabel("Téléphone").fill("20000001");
  await page.getByRole("button", { name: "Suivre ma commande" }).click();
  await expect(page.getByTestId("tracking-error")).toHaveText(
    "Aucune commande trouvée avec ces informations",
  );

  // Right number + phone (any format, any case): status shown, no personal data.
  await page.getByLabel("Numéro de commande").fill(number.toLowerCase());
  await page.getByLabel("Téléphone").fill("+216 20 000 001");
  await page.getByRole("button", { name: "Suivre ma commande" }).click();
  await expect(page.getByTestId("tracking-status")).toHaveText("En attente de confirmation");
  await expect(page.getByTestId("tracking-result")).toContainText("T-shirt Coton Premium");
  await expect(page.getByTestId("order-total")).toHaveText(/TND/);
  await expect(page.getByText("1 rue des tests automatiques")).toHaveCount(0);
  await expect(page.getByText(FAKE_NAME)).toHaveCount(0);
});

test("selling the last unit marks the variant unavailable on the product page", async ({
  page,
}) => {
  await useFakeIp(page);
  await sql().query(`UPDATE "Variant" SET stock = 1 WHERE id = $1`, [variantId]);
  await seedCart(page, 1);
  await page.goto("/checkout");
  await hydrated(page);
  await fillCheckout(page, "20000006");
  await submit(page).click();
  await expect(page).toHaveURL(/\/order\/confirmation/);

  // placeOrder refreshed the cached catalog: L / Blanc is gone, L / Noir is not.
  await page.goto(PRODUCT);
  await hydrated(page);
  await page
    .getByRole("radiogroup", { name: /couleur/i })
    .getByRole("radio", { name: "Blanc" })
    .click();
  await expect(
    page
      .getByRole("radiogroup", { name: /taille/i })
      .getByRole("radio", { name: /^L .*indisponible/ }),
  ).toBeVisible();
});

test("an empty cart shows a friendly message (after hydration)", async ({ page }) => {
  await page.goto("/checkout");
  await hydrated(page);
  await expect(page.getByTestId("checkout-empty")).toBeVisible();
  await expect(page.getByRole("link", { name: "Découvrir le catalogue" })).toBeVisible();
});

test.describe("mobile 360px", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("full checkout, no horizontal overflow", async ({ page }) => {
    await useFakeIp(page);
    await seedCart(page, 1);
    await page.goto("/checkout");
    await hydrated(page);
    await expect(submit(page)).toBeEnabled();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await fillCheckout(page, "20000002");
    await submit(page).tap();
    await expect(page).toHaveURL(/\/order\/confirmation/);
    await expect(page.getByTestId("order-number")).toBeVisible();
    expect(await countTestOrdersByPhone("+21620000002")).toBe(1);
  });

  test("stock conflict: message, back to /cart, nothing ordered", async ({ page }) => {
    await useFakeIp(page);
    await seedCart(page, 3);
    await page.goto("/checkout");
    await hydrated(page);
    await expect(submit(page)).toBeEnabled();
    await fillCheckout(page, "20000003");

    // Someone else buys most of the stock after the page loaded.
    await sql().query(`UPDATE "Variant" SET stock = 1 WHERE id = $1`, [variantId]);
    await submit(page).tap();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/ne sont plus disponibles en quantité suffisante/)).toBeVisible();
    expect(await countTestOrdersByPhone("+21620000003")).toBe(0);
    const { rows } = await sql().query(`SELECT stock FROM "Variant" WHERE id = $1`, [variantId]);
    expect(rows[0].stock).toBe(1);
    // The cart refreshed itself to what is left.
    await expect(page.getByTestId("line-quantity")).toHaveText("1");
  });

  test("double click on submit creates exactly one order", async ({ page }) => {
    await useFakeIp(page);
    await seedCart(page, 1);
    await page.goto("/checkout");
    await hydrated(page);
    await fillCheckout(page, "20000004");
    await submit(page).dblclick();
    await expect(page).toHaveURL(/\/order\/confirmation/);
    expect(await countTestOrdersByPhone("+21620000004")).toBe(1);
  });

  test("two submits in the same tick (bypassing the disabled button) create one order", async ({
    page,
  }) => {
    await useFakeIp(page);
    await seedCart(page, 1);
    await page.goto("/checkout");
    await hydrated(page);
    await fillCheckout(page, "20000005");
    await page.evaluate(() => {
      const form = document.getElementById("checkout-form") as HTMLFormElement;
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page).toHaveURL(/\/order\/confirmation/);
    expect(await countTestOrdersByPhone("+21620000005")).toBe(1);
  });
});
