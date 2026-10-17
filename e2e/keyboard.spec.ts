import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Read-only keyboard and focus checks: every dialog traps focus and closes with Escape (focus
 * returns to its trigger), variant selectors work with the arrow keys, and every focusable
 * element shows a visible focus indicator.
 */
const PRODUCT = "/p/t-shirt-coton-premium";

async function hydrated(page: Page) {
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
}

/** Presses Tab `times` and asserts focus never leaves `dialog`. */
async function focusStaysIn(page: Page, dialog: Locator, times = 14) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("Tab");
    // The wrap-around goes through focus guards that hand focus back asynchronously.
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)), {
        message: `focus escaped the dialog after ${i + 1} Tab presses`,
      })
      .toBe(true);
  }
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  }
}

async function expectEscapeClosesAndRestoresFocus(page: Page, dialog: Locator, trigger: Locator) {
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

test.describe("dialogs: focus trap, Escape, focus restore", () => {
  test("lightbox", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    const trigger = page.getByRole("button", { name: "Agrandir la photo" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await focusStaysIn(page, dialog);
    await expectEscapeClosesAndRestoresFocus(page, dialog, trigger);
  });

  test("cart drawer", async ({ page }) => {
    await page.goto(PRODUCT);
    await hydrated(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    const dialogTrigger = page.getByRole("link", { name: /Panier, \d+ article/ });
    await dialogTrigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("cart-line")).toBeVisible();
    await focusStaysIn(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test.describe("mobile 360px", () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

    test("header menu", async ({ page }) => {
      await page.goto("/");
      await hydrated(page);
      const trigger = page.getByRole("button", { name: "Ouvrir le menu" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await focusStaysIn(page, dialog);
      await expectEscapeClosesAndRestoresFocus(page, dialog, trigger);
    });

    test("filters drawer", async ({ page }) => {
      await page.goto("/c/parfums");
      await hydrated(page);
      const trigger = page.getByRole("button", { name: /^Filtres/ });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await focusStaysIn(page, dialog);
      await expectEscapeClosesAndRestoresFocus(page, dialog, trigger);
    });
  });
});

test("variant selectors are operable with the keyboard (radio group arrows + Space)", async ({
  page,
}) => {
  await page.goto(PRODUCT);
  await hydrated(page);
  const sizes = page.getByRole("radiogroup", { name: /taille/i });
  const radios = sizes.getByRole("radio");
  await radios.first().focus();
  await page.keyboard.press("Space");
  await expect(radios.first()).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(radios.first()).toHaveAttribute("aria-checked", "false");
});

test("the skip link is the first tab stop and jumps to the content", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
});

test.describe("visible focus indicator on every tab stop", () => {
  for (const path of ["/", "/c/parfums", PRODUCT, "/cart", "/suivi", "/admin/login"]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      if (path !== "/admin/login") await hydrated(page);
      const missing: string[] = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow !== "none" && cs.boxShadow !== "";
          const border = el.matches("input,textarea,select"); // fields change their border colour
          const desc = `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}`;
          return { visible: outline || shadow || border, desc };
        });
        if (info && !info.visible) missing.push(info.desc);
      }
      expect(missing).toEqual([]);
    });
  }
});
