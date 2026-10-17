import { expect, test } from "@playwright/test";

/**
 * Read-only: an unauthenticated request to the admin order pages and to the CSV export must be
 * redirected to the login page (the proxy), never served. No credentials, no database writes.
 */
const PROTECTED = [
  "/admin",
  "/admin/orders",
  "/admin/orders/some-order-id",
  "/admin/orders/some-order-id/print",
  "/admin/orders/export",
  "/admin/orders/export?status=PENDING",
  "/admin/shipping",
  "/admin/settings",
];

for (const path of PROTECTED) {
  test(`unauthenticated ${path} is redirected to the login page`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("/admin/login");
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
  });
}

test("the CSV export never answers 200 without a session", async ({ request }) => {
  const response = await request.get("/admin/orders/export", { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
});
