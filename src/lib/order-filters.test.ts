import { describe, expect, it } from "vitest";
import {
  buildOrderWhere,
  buildOrdersHref,
  parseOrderFilters,
  parseOrderFiltersFromSearchParams,
  phoneSearchDigits,
} from "./order-filters";

describe("phoneSearchDigits", () => {
  it.each([
    ["22 123 456", "22123456"],
    ["+21622123456", "22123456"],
    ["+216 22 123 456", "22123456"],
    ["0021622123456", "22123456"],
    ["22123456", "22123456"],
    ["22.123.456", "22123456"],
    ["221", "221"],
  ])("%s -> %s", (input, expected) => {
    expect(phoneSearchDigits(input)).toBe(expected);
  });

  it("is null for names, order numbers and too-short input", () => {
    expect(phoneSearchDigits("Amine")).toBeNull();
    expect(phoneSearchDigits("ORD-000123")).toBeNull();
    expect(phoneSearchDigits("12")).toBeNull();
    expect(phoneSearchDigits("")).toBeNull();
  });
});

describe("parseOrderFilters", () => {
  it("whitelists statuses, accepts comma and repeated forms", () => {
    expect(parseOrderFilters({ status: "PENDING,HACK,SHIPPED" }).statuses).toEqual([
      "PENDING",
      "SHIPPED",
    ]);
    expect(parseOrderFilters({ status: ["CANCELLED", "PENDING"] }).statuses).toEqual([
      "PENDING",
      "CANCELLED",
    ]);
    expect(parseOrderFilters({ status: "nope" }).statuses).toEqual([]);
  });

  it("rejects invalid dates and clamps the page", () => {
    const f = parseOrderFilters({ from: "2026-13-01", to: "2026-10-16", page: "-4" });
    expect(f.from).toBeNull();
    expect(f.to).toBe("2026-10-16");
    expect(f.page).toBe(1);
    expect(parseOrderFilters({ page: "abc" }).page).toBe(1);
    expect(parseOrderFilters({ page: "3" }).page).toBe(3);
  });

  it("caps the search length", () => {
    expect(parseOrderFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("reads URLSearchParams the same way", () => {
    const f = parseOrderFiltersFromSearchParams(
      new URLSearchParams("status=PENDING&status=SHIPPED&q=ali"),
    );
    expect(f.statuses).toEqual(["PENDING", "SHIPPED"]);
    expect(f.q).toBe("ali");
  });
});

describe("buildOrderWhere", () => {
  const base = parseOrderFilters({});

  it("is empty without filters", () => {
    expect(buildOrderWhere(base)).toEqual({});
  });

  it("searches number, name and phone digits", () => {
    const where = buildOrderWhere({ ...base, q: "+216 22 123 456" });
    expect(JSON.stringify(where)).toContain('"phone":{"contains":"22123456"}');
    expect(JSON.stringify(where)).toContain('"number"');
    expect(JSON.stringify(where)).toContain('"customerName"');
  });

  it("does not add a phone clause for a name", () => {
    expect(JSON.stringify(buildOrderWhere({ ...base, q: "Amine" }))).not.toContain('"phone"');
  });

  it("uses Tunisian day boundaries, inclusive of the end day", () => {
    const where = buildOrderWhere({ ...base, from: "2026-10-16", to: "2026-10-16" });
    expect(JSON.stringify(where)).toContain(
      '"gte":"2026-10-15T23:00:00.000Z","lt":"2026-10-16T23:00:00.000Z"',
    );
  });

  it("can ignore the status (for the tab counts)", () => {
    const filters = { ...base, statuses: ["PENDING" as const] };
    expect(buildOrderWhere(filters, { ignoreStatus: true })).toEqual({});
    expect(JSON.stringify(buildOrderWhere(filters))).toContain("PENDING");
  });
});

describe("buildOrdersHref", () => {
  it("round-trips filters and resets the page", () => {
    const f = parseOrderFilters({ status: "PENDING", q: "ali", page: "4" });
    expect(buildOrdersHref(f, { page: 4 })).toBe("/admin/orders?status=PENDING&q=ali&page=4");
    expect(buildOrdersHref(f)).toBe("/admin/orders?status=PENDING&q=ali"); // page resets
    expect(buildOrdersHref(f, { statuses: [], page: 1 })).toBe("/admin/orders?q=ali");
    expect(buildOrdersHref(parseOrderFilters({}), {}, "/admin/orders/export")).toBe(
      "/admin/orders/export",
    );
  });
});
