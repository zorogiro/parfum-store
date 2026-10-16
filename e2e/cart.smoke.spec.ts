import { expect, test, type Page } from "@playwright/test";

// Seeded clothing product: sizes S-XL x colors Noir/Blanc, 35,000 TND, stock 10 per variant.
const PRODUCT = "/p/t-shirt-coton-premium";
const NAME = "T-shirt Coton Premium";
const CART_KEY = "parfum-store.cart.v1";

const badge = (page: Page) => page.getByTestId("cart-badge");

/** Wait for hydration: clicking before the cart provider is live would be lost. */
async function hydrated(page: Page) {
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

test.describe("desktop", () => {
  test("product options, add to cart, /cart edits and persistence", async ({ page }) => {
    await ready(page, PRODUCT);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await expect(badge(page)).toHaveText("0");

    // Options: clicking a color / size selects it.
    const colors = page.getByRole("radiogroup", { name: /couleur/i });
    const sizes = page.getByRole("radiogroup", { name: /taille/i });
    const white = colors.getByRole("radio", { name: "Blanc" });
    const sizeL = sizes.getByRole("radio", { name: "L", exact: true });
    await white.click();
    await expect(white).toHaveAttribute("aria-checked", "true");
    await expect(colors.getByRole("radio", { name: "Noir" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await sizeL.click();
    await expect(sizeL).toHaveAttribute("aria-checked", "true");

    // Disabled options (none with the seed stock, but any disabled one must say it is unavailable).
    for (const radio of await page.getByRole("radio", { disabled: true }).all()) {
      await expect(radio).toHaveAccessibleName(/indisponible/);
    }

    // Quantity 1 -> 3; "-" is disabled at 1.
    const decrease = page.getByRole("button", { name: "Diminuer la quantité" });
    const increase = page.getByRole("button", { name: "Augmenter la quantité" });
    await expect(decrease).toBeDisabled();
    await increase.click();
    await increase.click();
    await expect(page.getByRole("group", { name: "Quantité" }).locator("output")).toHaveText("3");

    // Add to cart: toast + badge.
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await expect(page.getByText("Ajouté au panier")).toBeVisible();
    await expect(badge(page)).toHaveText("3");

    // The toast action opens the drawer with the line.
    await page.getByRole("button", { name: "Voir le panier" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(NAME)).toBeVisible();
    await expect(drawer.getByText("L / Blanc")).toBeVisible();
    await expect(drawer.getByTestId("line-quantity")).toHaveText("3");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // The header button opens the drawer too.
    await page.getByRole("link", { name: /Panier, 3 article/ }).click();
    await expect(page.getByRole("dialog").getByText(NAME)).toBeVisible();
    await page.keyboard.press("Escape");

    // Full page.
    await ready(page, "/cart");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line.getByTestId("line-quantity")).toHaveText("3");
    await expect(line.getByTestId("line-total")).toHaveText("105,000 TND");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("105,000 TND");
    await expect(page.getByText("Frais de livraison calculés à l'étape suivante")).toBeVisible();
    await expect(page.getByTestId("free-shipping-message")).toContainText(
      /Plus que .* TND pour la livraison gratuite/,
    );
    await expect(page.getByRole("link", { name: "Commander" })).toHaveAttribute(
      "href",
      "/checkout",
    );

    await line.getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(line.getByTestId("line-quantity")).toHaveText("4");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("140,000 TND");
    await expect(badge(page)).toHaveText("4");

    // Persistence across a reload.
    await page.reload();
    await hydrated(page);
    await expect(page.getByTestId("line-quantity")).toHaveText("4");
    await expect(badge(page)).toHaveText("4");

    // Remove -> empty state, badge 0.
    await page.getByRole("button", { name: /Retirer .* du panier/ }).click();
    await expect(page.getByText("Votre panier est vide")).toBeVisible();
    await expect(page.getByRole("link", { name: "Découvrir le catalogue" })).toBeVisible();
    await expect(badge(page)).toHaveText("0");
  });

  test("a corrupted cart in localStorage renders an empty cart", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "{broken"), CART_KEY);
    await ready(page, "/cart");
    await expect(page.getByText("Votre panier est vide")).toBeVisible();
    await expect(badge(page)).toHaveText("0");
  });

  test("an unknown variant is shown as unavailable and checkout stays disabled", async ({
    page,
  }) => {
    await page.addInitScript(
      (key) =>
        localStorage.setItem(key, JSON.stringify([{ variantId: "doesnotexist", quantity: 2 }])),
      CART_KEY,
    );
    await ready(page, "/cart");
    await expect(page.getByText("Plus disponible")).toBeVisible();
    await expect(page.getByRole("button", { name: "Commander" })).toBeDisabled();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("0,000 TND");
  });

  test("lightbox opens, has a French close button, and closes", async ({ page }) => {
    await ready(page, PRODUCT);
    await page.getByRole("button", { name: "Agrandir la photo" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Fermer" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Agrandir la photo" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("mobile 360px", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("sticky bar appears on scroll and adds to the cart; no horizontal overflow", async ({
    page,
  }) => {
    await ready(page, PRODUCT);
    const bar = page.locator("div.fixed.inset-x-0.bottom-0");
    const main = page.getByRole("button", { name: "Ajouter au panier" }).first();

    // Main button below the fold on a 360px screen: the sticky bar is shown.
    await expect(bar).not.toHaveAttribute("inert");
    // Main button scrolled into view: the sticky bar hides.
    await main.scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute("inert", "");
    // Scroll back to the top: the bar is back, and adds to the cart.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).not.toHaveAttribute("inert");
    await bar.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(badge(page)).toHaveText("1");

    for (const path of [PRODUCT, "/cart"]) {
      await ready(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
