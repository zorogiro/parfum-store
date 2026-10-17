import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static review: every admin server action, admin query, admin route handler and admin page must
 * call requireAdmin() as its FIRST awaited statement, before any data is touched. The proxy is
 * not enough. A new "use server" file must be classified below, so it cannot be forgotten.
 */
const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

/** Public actions: guest checkout, cart, tracking, and the login/logout actions themselves. */
const PUBLIC_ACTION_FILES = [
  "src/server/checkout.ts",
  "src/server/cart.ts",
  "src/server/tracking.ts",
  "src/server/login-action.ts",
];

/** Server action files that must be admin-only. */
const ADMIN_ACTION_FILES = [
  "src/server/categories.ts",
  "src/server/products.ts",
  "src/server/images.ts",
  "src/server/orders.ts",
  "src/server/shipping.ts",
  "src/server/settings.ts",
];

/** Plain modules called by admin pages and route handlers: they re-check the session too. */
const ADMIN_QUERY_FILES = ["src/server/orders-queries.ts", "src/server/dashboard.ts"];

/** The first `await` of each exported async function, or of the default page function. */
function firstAwaits(source: string, pattern: RegExp): { name: string; first: string | null }[] {
  const starts = [...source.matchAll(pattern)];
  return starts.map((match, i) => {
    const from = match.index!;
    const to = starts[i + 1]?.index ?? source.length;
    const body = source.slice(from, to);
    return { name: match[1], first: /await\s+([A-Za-z_.]+)/.exec(body)?.[1] ?? null };
  });
}

const EXPORTED_ASYNC = /export\s+async\s+function\s+(\w+)/g;

describe("requireAdmin coverage", () => {
  it("every 'use server' file is classified as public or admin", () => {
    const known = new Set([...PUBLIC_ACTION_FILES, ...ADMIN_ACTION_FILES]);
    const unclassified = walk("src")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"))
      .filter((f) => /^\s*["']use server["']/m.test(read(f).slice(0, 200)))
      .filter((f) => !known.has(f.replaceAll("\\", "/")));
    expect(unclassified).toEqual([]);
  });

  for (const file of [...ADMIN_ACTION_FILES, ...ADMIN_QUERY_FILES]) {
    it(`${file}: every exported function starts with requireAdmin()`, () => {
      const functions = firstAwaits(read(file), EXPORTED_ASYNC);
      expect(functions.length).toBeGreaterThan(0);
      for (const fn of functions) expect([fn.name, fn.first]).toEqual([fn.name, "requireAdmin"]);
    });
  }

  it("every admin route handler starts with requireAdmin()", () => {
    const handlers = walk("src/app/admin").filter((f) => /\/route\.ts$/.test(f));
    expect(handlers.length).toBeGreaterThan(0);
    for (const file of handlers) {
      const functions = firstAwaits(read(file), EXPORTED_ASYNC);
      expect(functions.length).toBeGreaterThan(0);
      for (const fn of functions)
        expect([file, fn.name, fn.first]).toEqual([file, fn.name, "requireAdmin"]);
    }
  });

  it("every admin page (panel and print) starts with requireAdmin()", () => {
    const pages = walk("src/app/admin").filter(
      (f) => /\/page\.tsx$/.test(f) && !f.includes("/admin/login/"),
    );
    expect(pages.length).toBeGreaterThan(5);
    for (const file of pages) {
      const functions = firstAwaits(read(file), /export\s+default\s+async\s+function\s+(\w+)/g);
      expect(functions.length, file).toBe(1);
      expect([file, functions[0].first]).toEqual([file, "requireAdmin"]);
    }
  });

  it("the panel and print layouts require the admin session", () => {
    expect(read("src/app/admin/(panel)/layout.tsx")).toMatch(/await requireAdmin\(\)/);
    expect(read("src/app/admin/(print)/layout.tsx")).toMatch(/await requireAdmin\(\)/);
  });
});
