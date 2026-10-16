import "dotenv/config";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility and mobile checks of the logged-in admin panel (axe-core WCAG A/AA, and no
 * horizontal overflow at 390px). It only READS data, but it needs the admin credentials
 * (ADMIN_EMAIL / ADMIN_PASSWORD from the environment, never printed); skipped without them.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set ADMIN_EMAIL and ADMIN_PASSWORD to run.");

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL!);
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" ") + " " + n.html.slice(0, 100))
        .join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

const PAGES = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/products/new",
  "/admin/categories",
  "/admin/categories/new",
  "/admin/shipping",
  "/admin/settings",
];

test("axe-core on the admin pages (desktop)", async ({ page }) => {
  await login(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await test.step(path, () => scan(page));
  }
  // An existing product's edit form (variants, images) and an existing order.
  await page.goto("/admin/products");
  await page
    .getByRole("link", { name: /Modifier|Éditer/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/);
  await page.waitForLoadState("networkidle");
  await test.step("product edit form", () => scan(page));
});

test.describe("390px phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("admin pages fit the screen (no horizontal overflow) and pass axe", async ({ page }) => {
    await login(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
      await test.step(path, () => scan(page));
    }
  });
});
