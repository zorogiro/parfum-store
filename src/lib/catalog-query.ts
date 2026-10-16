import type { Prisma } from "@/generated/prisma/client";
import { parseTND, toTNDInputValue } from "@/lib/money";

/**
 * Pure helpers that turn URL search params into a validated listing request and
 * into Prisma `where` clauses. Everything coming from the URL is untrusted: it is
 * clamped, whitelisted or dropped here, never passed through as-is.
 */

export const PAGE_SIZE = 12;
export const SORT_OPTIONS = ["newest", "price_asc", "price_desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const MAX_PAGE = 1000;
export const MAX_FILTER_VALUES = 20;
export const MAX_VALUE_LENGTH = 60;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_SEARCH_TERMS = 5;
const MAX_FILTER_PRICE = 100_000_000; // millimes, same ceiling as the admin form
const MAX_VOLUME_ML = 5000;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListingFilters = {
  sort: SortOption;
  page: number;
  /** Millimes. */
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  brands: string[];
  volumes: number[];
  sizes: string[];
  colors: string[];
};

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string {
  return all(value)[0]?.trim() ?? "";
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").trim().slice(0, MAX_VALUE_LENGTH);
}

/** Deduplicated, trimmed, length-capped list of text values. */
function textList(value: string | string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of all(value)) {
    const v = cleanText(raw);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= MAX_FILTER_VALUES) break;
  }
  return out;
}

function intList(value: string | string[] | undefined, max: number): number[] {
  const out: number[] = [];
  for (const raw of all(value)) {
    const v = raw.trim();
    if (!/^\d{1,6}$/.test(v)) continue;
    const n = Number(v);
    if (n < 1 || n > max || out.includes(n)) continue;
    out.push(n);
    if (out.length >= MAX_FILTER_VALUES) break;
  }
  return out;
}

export function parsePage(value: string | string[] | undefined): number {
  const v = first(value);
  if (!/^\d{1,6}$/.test(v)) return 1;
  const n = Number(v);
  return n < 1 ? 1 : Math.min(n, MAX_PAGE);
}

export function parseSort(value: string | string[] | undefined): SortOption {
  const v = first(value);
  return (SORT_OPTIONS as readonly string[]).includes(v) ? (v as SortOption) : "newest";
}

/** A price typed in TND ("45", "45.5", "45,500") -> millimes, or undefined if unusable. */
export function parsePriceParam(value: string | string[] | undefined): number | undefined {
  const v = first(value);
  if (!v || v.length > 20) return undefined;
  const millimes = parseTND(v);
  if (millimes === null || millimes > MAX_FILTER_PRICE) return undefined;
  return millimes;
}

export function parseListingParams(raw: RawSearchParams): ListingFilters {
  let minPrice = parsePriceParam(raw.min);
  let maxPrice = parsePriceParam(raw.max);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    sort: parseSort(raw.sort),
    page: parsePage(raw.page),
    minPrice,
    maxPrice,
    inStock: first(raw.stock) === "1",
    brands: textList(raw.brand),
    volumes: intList(raw.volume, MAX_VOLUME_ML),
    sizes: textList(raw.size),
    colors: textList(raw.color),
  };
}

/** Search text: control characters removed, whitespace collapsed, length capped. */
export function parseSearchQuery(value: string | string[] | undefined): string {
  return first(value)
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

export function hasActiveFilters(f: ListingFilters): boolean {
  return (
    f.minPrice !== undefined ||
    f.maxPrice !== undefined ||
    f.inStock ||
    f.brands.length > 0 ||
    f.volumes.length > 0 ||
    f.sizes.length > 0 ||
    f.colors.length > 0
  );
}

export function activeFilterCount(f: ListingFilters): number {
  return (
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    f.brands.length +
    f.volumes.length +
    f.sizes.length +
    f.colors.length
  );
}

/** Canonical filters with no active filter, keeping only the sort. */
export function withoutFilters(f: ListingFilters): ListingFilters {
  return { sort: f.sort, page: 1, inStock: false, brands: [], volumes: [], sizes: [], colors: [] };
}

export function priceParam(millimes: number): string {
  return toTNDInputValue(millimes).replace(/\.000$/, "");
}

/** Stable, shareable URL for a listing. Default values are omitted. */
export function buildListingHref(
  basePath: string,
  filters: ListingFilters,
  extra: { q?: string } = {},
): string {
  const p = new URLSearchParams();
  if (extra.q) p.set("q", extra.q);
  if (filters.sort !== "newest") p.set("sort", filters.sort);
  if (filters.minPrice !== undefined) p.set("min", priceParam(filters.minPrice));
  if (filters.maxPrice !== undefined) p.set("max", priceParam(filters.maxPrice));
  if (filters.inStock) p.set("stock", "1");
  for (const v of filters.brands) p.append("brand", v);
  for (const v of filters.volumes) p.append("volume", String(v));
  for (const v of filters.sizes) p.append("size", v);
  for (const v of filters.colors) p.append("color", v);
  if (filters.page > 1) p.set("page", String(filters.page));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Prisma `where` for the user-selectable filters. Variant-level conditions
 * (price, stock, volume, size, color) are combined inside a single `some`, so
 * "size M and in stock" means one variant that is both.
 */
export function buildFilterWhere(f: ListingFilters): Prisma.ProductWhereInput {
  const variantConditions: Prisma.VariantWhereInput[] = [];
  if (f.minPrice !== undefined) variantConditions.push({ price: { gte: f.minPrice } });
  if (f.maxPrice !== undefined) variantConditions.push({ price: { lte: f.maxPrice } });
  if (f.inStock) variantConditions.push({ stock: { gt: 0 } });
  if (f.volumes.length > 0) {
    variantConditions.push({
      OR: f.volumes.map((v) => ({ options: { path: ["volumeMl"], equals: v } })),
    });
  }
  if (f.sizes.length > 0) {
    variantConditions.push({
      OR: f.sizes.map((v) => ({ options: { path: ["size"], equals: v } })),
    });
  }
  if (f.colors.length > 0) {
    variantConditions.push({
      OR: f.colors.map((v) => ({ options: { path: ["color"], equals: v } })),
    });
  }

  return {
    ...(f.brands.length > 0 && { brand: { in: f.brands, mode: "insensitive" } }),
    ...(variantConditions.length > 0 && { variants: { some: { AND: variantConditions } } }),
  };
}

/** Escapes LIKE wildcards: Prisma's `contains` passes `%` and `_` through unescaped. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function searchTerms(q: string): string[] {
  return q.split(" ").filter(Boolean).slice(0, MAX_SEARCH_TERMS);
}

/** Every word must match the product name, brand, or its category / parent category name. */
export function buildSearchWhere(q: string): Prisma.ProductWhereInput {
  const terms = searchTerms(q);
  if (terms.length === 0) return {};
  return {
    AND: terms.map((term) => {
      const contains = { contains: escapeLike(term), mode: "insensitive" as const };
      return {
        OR: [
          { name: contains },
          { brand: contains },
          { category: { name: contains } },
          { category: { parent: { name: contains } } },
        ],
      };
    }),
  };
}

export type SortableRow = { id: string; minPrice: number | null };

/** Sorts by lowest variant price; products without any variant go last. Ties break on id. */
export function sortByMinPrice<T extends SortableRow>(rows: T[], direction: "asc" | "desc"): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (a.minPrice === null && b.minPrice === null) return a.id.localeCompare(b.id);
    if (a.minPrice === null) return 1;
    if (b.minPrice === null) return -1;
    return a.minPrice === b.minPrice
      ? a.id.localeCompare(b.id)
      : (a.minPrice - b.minPrice) * factor;
  });
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Clamps the requested page to what exists and returns the Prisma skip/take. */
export function paginate(requestedPage: number, total: number) {
  const pages = pageCount(total);
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { page, pageCount: pages, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** Compact page list with gaps, e.g. [1, "…", 4, 5, 6, "…", 12]. */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}
