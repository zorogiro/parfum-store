import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests are read-only (no orders, no DB writes) and use the seeded products.
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
      },
});
