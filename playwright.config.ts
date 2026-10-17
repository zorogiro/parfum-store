import { defineConfig, devices } from "@playwright/test";

/**
 * cart.smoke.spec.ts is read-only (no orders, no DB writes) and uses the seeded products.
 * checkout.write.spec.ts WRITES to the database in DATABASE_URL (orders, stock) and cleans up
 * after itself; it is skipped unless E2E_ALLOW_DB_WRITES=1 (dev branch only).
 * They run against a production build served on port 3100 (never 3000, which is the dev server).
 * Run `npm run build` first; set E2E_BASE_URL to test an already running server instead.
 */
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The database is remote (Neon): saves and redirects can take a few seconds.
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", locale: "fr-FR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
        // Auth.js refuses an unknown host in production mode (UntrustedHost); the admin specs log in.
        env: { AUTH_TRUST_HOST: "true" },
      },
});
