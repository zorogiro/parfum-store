import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Read-only accessibility checks with axe-core (WCAG 2.0/2.1 A and AA rules, which include
 * colour contrast, labels, alt text, landmarks, names of buttons and links).
 */
const PRODUCT = "/p/t-shirt-coton-premium";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function hydrated(page: Page) {
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
}

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Readable failure message: rule id, impact and the first failing selectors (no page data).
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" ") + " " + n.html.slice(0, 100))
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

test.describe("axe-core", () => {
  test("home", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await scan(page);
  });

  test("category page", async ({ page }) => {
    await page.goto("/c/parfums");
    await hydrated(page);
    await scan(page);
  });

  test("category page with filters open", async ({ page }) => {
    await page.goto("/c/parfums?sort=price-asc&stock=1");
    await hydrated(page);
    await scan(page);
  });

  test("search results", async ({ page }) => {
    await page.goto("/search?q=parfum");
    await hydrated(page);
    await scan(page);
  });

  test("product page", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    await scan(page);
  });

  test("cart page (with a line)", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await expect(page.getByText("Ajouté au panier")).toBeVisible();
    await page.goto("/cart");
    await hydrated(page);
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await scan(page);
  });

  test("cart drawer", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await page.getByRole("button", { name: "Voir le panier" }).click();
    await expect(page.getByRole("dialog").getByTestId("cart-line")).toBeVisible();
    await scan(page);
  });

  test("checkout page (with a line)", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await expect(page.getByText("Ajouté au panier")).toBeVisible();
    await page.goto("/checkout");
    await hydrated(page);
    await expect(page.getByLabel("Nom complet")).toBeVisible();
    await scan(page);
  });

  test("order tracking page and legal page", async ({ page }) => {
    await page.goto("/suivi");
    await hydrated(page);
    await scan(page);
    await page.goto("/retours");
    await scan(page);
  });

  test("admin login page", async ({ page }) => {
    await page.goto("/admin/login");
    await scan(page);
  });

  test.describe("mobile 360px", () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

    test("home with the menu open", async ({ page }) => {
      await page.goto("/");
      await hydrated(page);
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page);
    });

    test("product page", async ({ page }) => {
      await page.goto(PRODUCT);
      await hydrated(page);
      await scan(page);
    });

    test("no horizontal overflow on the main storefront pages", async ({ page }) => {
      for (const path of [
        "/",
        "/c/parfums",
        "/c/parfums?stock=1&sort=price-asc",
        "/search?q=parfum",
        PRODUCT,
        "/cart",
        "/checkout",
        "/suivi",
        "/retours",
        "/introuvable",
      ]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows horizontally at 360px`).toBeLessThanOrEqual(0);
      }
    });
  });
});
