import { expect, test, type Page } from "@playwright/test";

/**
 * Read-only checks of the security headers, robots.txt / sitemap.xml and that the enforced
 * Content-Security-Policy does not break the storefront, the checkout form, Sonner toasts or the
 * admin login page (no CSP violation is reported by the browser).
 */
const PRODUCT = "/p/t-shirt-coton-premium";

async function hydrated(page: Page) {
  await expect(page.locator("[data-hydrated=true]")).toBeAttached();
}

/** Collects every Content-Security-Policy violation reported in the console or as an event. */
function trackCspViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/content security policy|refused to (load|execute|apply|connect)/i.test(msg.text())) {
      violations.push(msg.text().slice(0, 200));
    }
  });
  page.on("pageerror", (error) => {
    if (/content security policy/i.test(error.message))
      violations.push(error.message.slice(0, 200));
  });
  return violations;
}

test.describe("security headers", () => {
  for (const path of ["/", PRODUCT, "/c/parfums", "/cart", "/checkout", "/suivi", "/admin/login"]) {
    test(`${path} sends the security headers`, async ({ request }) => {
      const res = await request.get(path);
      const h = res.headers();
      const csp = h["content-security-policy"] ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("https://res.cloudinary.com");
      expect(csp).toContain("https://placehold.co");
      expect(csp).not.toContain("unsafe-eval"); // production build only
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
    });
  }

  test("pages with personal data or no SEO value are noindex", async ({ request }) => {
    for (const path of ["/checkout", "/suivi", "/cart", "/search?q=a", "/admin/login"]) {
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"], path).toContain("noindex");
    }
  });
});

test.describe("CSP does not break the app", () => {
  test("storefront: product page, toast, drawer, cart, checkout form", async ({ page }) => {
    const violations = trackCspViolations(page);
    await page.goto(PRODUCT);
    await hydrated(page);
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await expect(page.getByText("Ajouté au panier")).toBeVisible(); // Sonner toast
    await page.getByRole("button", { name: "Voir le panier" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/cart");
    await hydrated(page);
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await page.goto("/checkout");
    await hydrated(page);
    await expect(page.getByLabel("Nom complet")).toBeVisible();
    await page.getByLabel("Nom complet").fill("x");
    expect(violations).toEqual([]);
  });

  test("images (Next image optimizer) load on the home page", async ({ page }) => {
    const violations = trackCspViolations(page);
    await page.goto("/");
    await hydrated(page);
    const broken = await page.evaluate(async () => {
      const imgs = [...document.images];
      await Promise.all(
        imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))),
      );
      return imgs.filter((i) => i.naturalWidth === 0 && i.loading !== "lazy").length;
    });
    expect(broken).toBe(0);
    expect(violations).toEqual([]);
  });

  test("admin login page renders and rejects a wrong password without CSP errors", async ({
    page,
  }) => {
    const violations = trackCspViolations(page);
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("nobody@example.invalid");
    await page.getByLabel("Mot de passe").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
    expect(violations).toEqual([]);
  });
});

test.describe("robots.txt and sitemap.xml", () => {
  test("robots.txt disallows private areas and points to the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    for (const path of ["/admin", "/cart", "/checkout", "/order", "/suivi", "/search"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    expect(body).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
  });

  test("sitemap.xml lists home, categories, active products and legal pages only", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(locs).toContain("/");
    expect(locs).toContain("/c/parfums");
    expect(locs).toContain(PRODUCT);
    expect(locs).toContain("/conditions-generales");
    expect(locs).toContain("/confidentialite");
    expect(locs).toContain("/retours");
    expect(locs.some((p) => p.startsWith("/p/"))).toBe(true);
    for (const p of locs) {
      expect(p, p).not.toMatch(/^\/(admin|cart|checkout|order|suivi|search)/);
    }
    // Products carry a lastmod date.
    expect(xml).toMatch(/<loc>[^<]*\/p\/[^<]+<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}/);
  });
});

test.describe("enumeration over HTTP", () => {
  test("confirmation links with a wrong/missing token are real 404s with the same body", async ({
    request,
  }) => {
    const token = "A".repeat(43);
    const urls = [
      "/order/confirmation",
      "/order/confirmation?number=ORD-000001",
      `/order/confirmation?number=ORD-000001&token=${token}`,
      `/order/confirmation?number=ORD-999999999&token=${token}`,
      `/order/confirmation?number=nope&token=${token}`,
    ];
    const bodies = new Set<string>();
    for (const url of urls) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(404);
      expect(res.headers()["cache-control"], url).toContain("no-store");
      bodies.add((await res.text()).replace(/<script[\s\S]*?<\/script>/g, "").length.toString());
    }
    // Existing and non-existing numbers are indistinguishable.
    expect(bodies.size).toBe(1);
  });
});
