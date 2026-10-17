import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: the order trackingToken is the only secret protecting /order/confirmation, so
 * it must never reach the admin UI, the CSV export, emails, logs or the public tracking result.
 * Only the checkout flow (which hands it to the buyer's browser once) and the lookup that
 * verifies it may mention it.
 */
const root = path.resolve(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}
/** Source without comments (a comment saying the token is NOT selected is fine). */
const source = (f: string) =>
  readFileSync(path.join(root, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const code = (dir: string) => walk(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));

describe("trackingToken exposure", () => {
  const forbidden = [
    ...code("src/app/admin"),
    ...code("src/components/admin"),
    "src/server/orders-queries.ts",
    "src/server/orders.ts",
    "src/server/dashboard.ts",
    "src/server/email.ts",
    "src/lib/order-email.ts",
    "src/lib/csv.ts",
    "src/server/tracking.ts",
    "src/lib/validators/admin-orders.ts",
  ];

  it.each(forbidden)("%s never references the tracking token", (file) => {
    expect(source(file)).not.toMatch(/trackingToken/i);
  });

  it("the email payload type has no token field", () => {
    expect(source("src/lib/order-email.ts")).not.toMatch(/token/i);
  });

  it("no server code logs a token", () => {
    for (const file of code("src/server")) {
      const logs = source(file).match(/console\.\w+\([^)]*\)/g) ?? [];
      for (const call of logs) expect(call, file).not.toMatch(/token/i);
    }
  });
});
