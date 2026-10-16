import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  MAX_FILTER_VALUES,
  MAX_PAGE,
  MAX_SEARCH_LENGTH,
  buildFilterWhere,
  buildListingHref,
  buildSearchWhere,
  escapeLike,
  pageWindow,
  paginate,
  parseListingParams,
  parsePage,
  parseSearchQuery,
  parseSort,
  sortByMinPrice,
  withoutFilters,
} from "./catalog-query";
import { collectFacets, toProductCardData } from "./product-card-data";

describe("parsePage", () => {
  it("defaults to 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
  });
  it("accepts positive integers", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["4", "9"])).toBe(4);
  });
  it("rejects negative, zero, decimal and non-numeric values", () => {
    for (const bad of [
      "-1",
      "0",
      "1.5",
      "abc",
      "1e3",
      "0x10",
      "NaN",
      "Infinity",
      "٣",
      "2 OR 1=1",
    ]) {
      expect(parsePage(bad)).toBe(1);
    }
  });
  it("caps huge values", () => {
    expect(parsePage("999999")).toBe(MAX_PAGE);
    expect(parsePage("99999999999999999999")).toBe(1); // too long to be a plausible page
  });
});

describe("parseSort", () => {
  it("accepts known values", () => {
    expect(parseSort("price_asc")).toBe("price_asc");
    expect(parseSort("price_desc")).toBe("price_desc");
    expect(parseSort("newest")).toBe("newest");
  });
  it("falls back to newest for unknown values", () => {
    for (const bad of ["", "price", "PRICE_ASC", "createdAt; DROP TABLE", "__proto__", undefined]) {
      expect(parseSort(bad)).toBe("newest");
    }
  });
});

describe("parseListingParams", () => {
  it("returns defaults for empty params", () => {
    expect(parseListingParams({})).toEqual({
      sort: "newest",
      page: 1,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: false,
      brands: [],
      volumes: [],
      sizes: [],
      colors: [],
    });
  });

  it("parses a full valid set of filters", () => {
    const f = parseListingParams({
      sort: "price_desc",
      page: "2",
      min: "10",
      max: "150,5",
      stock: "1",
      brand: ["Maison Atlas", "Dior"],
      volume: ["50", "100"],
      size: "M",
      color: ["Noir"],
    });
    expect(f).toMatchObject({
      sort: "price_desc",
      page: 2,
      minPrice: 10_000,
      maxPrice: 150_500,
      inStock: true,
      brands: ["Maison Atlas", "Dior"],
      volumes: [50, 100],
      sizes: ["M"],
      colors: ["Noir"],
    });
  });

  it("ignores non-numeric and negative prices", () => {
    const f = parseListingParams({ min: "abc", max: "-5" });
    expect(f.minPrice).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
    expect(parseListingParams({ min: "1e9" }).minPrice).toBeUndefined();
    expect(parseListingParams({ min: "1; DROP TABLE" }).minPrice).toBeUndefined();
    expect(parseListingParams({ max: "9".repeat(50) }).maxPrice).toBeUndefined();
  });

  it("ignores absurdly large prices", () => {
    expect(parseListingParams({ max: "999999999" }).maxPrice).toBeUndefined();
  });

  it("swaps an inverted price range", () => {
    const f = parseListingParams({ min: "200", max: "50" });
    expect(f.minPrice).toBe(50_000);
    expect(f.maxPrice).toBe(200_000);
  });

  it("only treats stock=1 as in-stock", () => {
    expect(parseListingParams({ stock: "true" }).inStock).toBe(false);
    expect(parseListingParams({ stock: "0" }).inStock).toBe(false);
    expect(parseListingParams({ stock: "1" }).inStock).toBe(true);
  });

  it("drops invalid volumes", () => {
    const f = parseListingParams({ volume: ["50", "-3", "0", "x", "1.5", "99999", "50", "100"] });
    expect(f.volumes).toEqual([50, 100]);
  });

  it("dedupes, trims and caps list values", () => {
    const many = Array.from({ length: 100 }, (_, i) => `b${i}`);
    expect(parseListingParams({ brand: many }).brands).toHaveLength(MAX_FILTER_VALUES);
    expect(parseListingParams({ brand: [" Dior ", "Dior", "", "  "] }).brands).toEqual(["Dior"]);
    expect(parseListingParams({ color: "x".repeat(500) }).colors[0]).toHaveLength(60);
  });

  it("strips control characters from text filters", () => {
    expect(parseListingParams({ brand: "Di\u0000or\n" }).brands).toEqual(["Dior"]);
  });
});

describe("parseSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(parseSearchQuery("  rose   de  carthage ")).toBe("rose de carthage");
  });
  it("uses the first value when repeated", () => {
    expect(parseSearchQuery(["a", "b"])).toBe("a");
  });
  it("caps the length and removes control characters", () => {
    expect(parseSearchQuery("x".repeat(1000))).toHaveLength(MAX_SEARCH_LENGTH);
    expect(parseSearchQuery("a\u0000b\tc")).toBe("a b c");
  });
  it("returns an empty string for missing input", () => {
    expect(parseSearchQuery(undefined)).toBe("");
  });
});

describe("buildFilterWhere", () => {
  it("is empty without filters", () => {
    expect(buildFilterWhere(parseListingParams({}))).toEqual({});
  });

  it("combines variant conditions in one `some`", () => {
    const where = buildFilterWhere(
      parseListingParams({ min: "10", max: "100", stock: "1", size: ["M", "L"], color: "Noir" }),
    );
    expect(where).toEqual({
      variants: {
        some: {
          AND: [
            { price: { gte: 10_000 } },
            { price: { lte: 100_000 } },
            { stock: { gt: 0 } },
            {
              OR: [
                { options: { path: ["size"], equals: "M" } },
                { options: { path: ["size"], equals: "L" } },
              ],
            },
            { OR: [{ options: { path: ["color"], equals: "Noir" } }] },
          ],
        },
      },
    });
  });

  it("filters perfumes by brand and volume", () => {
    const where = buildFilterWhere(parseListingParams({ brand: "Dior", volume: "100" }));
    expect(where).toEqual({
      brand: { in: ["Dior"], mode: "insensitive" },
      variants: {
        some: { AND: [{ OR: [{ options: { path: ["volumeMl"], equals: 100 } }] }] },
      },
    });
  });

  it("keeps malicious text as plain data values", () => {
    const evil = '\'; DROP TABLE "Product"; --';
    const where = buildFilterWhere(parseListingParams({ brand: evil }));
    expect(where).toEqual({ brand: { in: [evil], mode: "insensitive" } });
  });
});

describe("escapeLike / buildSearchWhere", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("plain")).toBe("plain");
  });

  it("is empty for an empty query", () => {
    expect(buildSearchWhere("")).toEqual({});
  });

  it("requires every word to match name, brand or category", () => {
    const where = buildSearchWhere("rose 50%");
    const and = (where as { AND: unknown[] }).AND;
    expect(and).toHaveLength(2);
    expect(and[1]).toEqual({
      OR: [
        { name: { contains: "50\\%", mode: "insensitive" } },
        { brand: { contains: "50\\%", mode: "insensitive" } },
        { category: { name: { contains: "50\\%", mode: "insensitive" } } },
        { category: { parent: { name: { contains: "50\\%", mode: "insensitive" } } } },
      ],
    });
  });

  it("limits the number of terms", () => {
    const where = buildSearchWhere("a b c d e f g h") as { AND: unknown[] };
    expect(where.AND).toHaveLength(5);
  });
});

describe("sortByMinPrice", () => {
  const rows = [
    { id: "b", minPrice: 200 },
    { id: "a", minPrice: 100 },
    { id: "n", minPrice: null },
    { id: "c", minPrice: 100 },
  ];
  it("sorts ascending with nulls last and a stable tie-break", () => {
    expect(sortByMinPrice(rows, "asc").map((r) => r.id)).toEqual(["a", "c", "b", "n"]);
  });
  it("sorts descending with nulls last", () => {
    expect(sortByMinPrice(rows, "desc").map((r) => r.id)).toEqual(["b", "a", "c", "n"]);
  });
  it("does not mutate its input", () => {
    const copy = [...rows];
    sortByMinPrice(rows, "asc");
    expect(rows).toEqual(copy);
  });
});

describe("paginate", () => {
  it("computes skip/take", () => {
    expect(paginate(1, 30)).toEqual({ page: 1, pageCount: 3, skip: 0, take: PAGE_SIZE });
    expect(paginate(3, 30)).toEqual({ page: 3, pageCount: 3, skip: 24, take: PAGE_SIZE });
  });
  it("clamps a page beyond the end", () => {
    expect(paginate(50, 30).page).toBe(3);
  });
  it("handles zero results", () => {
    expect(paginate(1, 0)).toEqual({ page: 1, pageCount: 1, skip: 0, take: PAGE_SIZE });
  });
  it("handles exact multiples", () => {
    expect(paginate(1, 24).pageCount).toBe(2);
    expect(paginate(1, 25).pageCount).toBe(3);
  });
});

describe("pageWindow", () => {
  it("lists all pages when few", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it("inserts gaps", () => {
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
  });
});

describe("buildListingHref", () => {
  it("omits defaults", () => {
    expect(buildListingHref("/c/parfums", parseListingParams({}))).toBe("/c/parfums");
  });
  it("round-trips through parseListingParams", () => {
    const filters = parseListingParams({
      sort: "price_asc",
      page: "3",
      min: "10.5",
      max: "99",
      stock: "1",
      brand: ["Maison Atlas"],
      volume: ["50"],
      size: ["M"],
      color: ["Noir & Blanc"],
    });
    const href = buildListingHref("/c/x", filters);
    const params = Object.fromEntries(
      [...new URL(href, "http://x").searchParams.keys()].map((k) => [
        k,
        new URL(href, "http://x").searchParams.getAll(k),
      ]),
    );
    expect(parseListingParams(params)).toEqual(filters);
  });
  it("encodes the search query", () => {
    expect(
      buildListingHref("/search", withoutFilters(parseListingParams({})), { q: "a&b c" }),
    ).toBe("/search?q=a%26b+c");
  });
});

describe("toProductCardData", () => {
  const base = { id: "1", slug: "s", name: "N", brand: null, images: [] };
  it("shows a single price", () => {
    const c = toProductCardData({
      ...base,
      variants: [{ price: 5000, compareAtPrice: null, stock: 3 }],
    });
    expect(c).toMatchObject({
      price: 5000,
      hasPriceRange: false,
      compareAtPrice: null,
      soldOut: false,
    });
  });
  it("flags a range and picks the cheapest price", () => {
    const c = toProductCardData({
      ...base,
      variants: [
        { price: 9000, compareAtPrice: null, stock: 1 },
        { price: 5000, compareAtPrice: 7000, stock: 0 },
      ],
    });
    expect(c).toMatchObject({
      price: 5000,
      hasPriceRange: true,
      compareAtPrice: 7000,
      soldOut: false,
    });
  });
  it("is sold out when every variant has zero stock", () => {
    const c = toProductCardData({
      ...base,
      variants: [{ price: 5000, compareAtPrice: null, stock: 0 }],
    });
    expect(c.soldOut).toBe(true);
  });
  it("survives a product without variants", () => {
    const c = toProductCardData({ ...base, variants: [] });
    expect(c).toMatchObject({ price: null, soldOut: true });
  });
  it("ignores a compare-at price that is not higher", () => {
    const c = toProductCardData({
      ...base,
      variants: [{ price: 5000, compareAtPrice: 5000, stock: 1 }],
    });
    expect(c.compareAtPrice).toBeNull();
  });
});

describe("collectFacets", () => {
  it("collects type-specific values", () => {
    const f = collectFacets([
      {
        type: "PERFUME",
        brand: "B",
        variants: [{ options: { volumeMl: 100 } }, { options: { volumeMl: 50 } }],
      },
      {
        type: "CLOTHING",
        brand: "Ignored",
        variants: [
          { options: { size: "XL", color: "Noir" } },
          { options: { size: "S", color: "Blanc" } },
        ],
      },
      { type: "ACCESSORY", brand: "X", variants: [{ options: { color: "Argent" } }] },
    ]);
    expect(f).toEqual({
      hasPerfumes: true,
      hasClothing: true,
      brands: ["B"],
      volumes: [50, 100],
      sizes: ["S", "XL"],
      colors: ["Blanc", "Noir"],
    });
  });
  it("tolerates malformed options", () => {
    const f = collectFacets([
      { type: "PERFUME", brand: null, variants: [{ options: null }, { options: "x" }] },
    ]);
    expect(f.volumes).toEqual([]);
  });
});
