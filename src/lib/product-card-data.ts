export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  /** Millimes. Null when the product has no variant. */
  price: number | null;
  /** True when variants have different prices ("À partir de"). */
  hasPriceRange: boolean;
  /** Millimes. Struck-through price of the displayed (cheapest) variant. */
  compareAtPrice: number | null;
  soldOut: boolean;
};

export type ProductCardRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  images: { url: string }[];
  variants: { price: number; compareAtPrice: number | null; stock: number }[];
};

export function toProductCardData(row: ProductCardRow): ProductCardData {
  const prices = row.variants.map((v) => v.price);
  const min = prices.length > 0 ? Math.min(...prices) : null;
  const max = prices.length > 0 ? Math.max(...prices) : null;

  // Among the cheapest variants, prefer one that has a compare-at price to show.
  const cheapest = row.variants.filter((v) => v.price === min);
  const compareAt =
    cheapest
      .map((v) => v.compareAtPrice)
      .find((c): c is number => c !== null && min !== null && c > min) ?? null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    imageUrl: row.images[0]?.url ?? null,
    price: min,
    hasPriceRange: min !== max,
    compareAtPrice: compareAt,
    soldOut: !row.variants.some((v) => v.stock > 0),
  };
}

export type FacetRow = {
  type: "PERFUME" | "CLOTHING" | "ACCESSORY";
  brand: string | null;
  variants: { options: unknown }[];
};

export type CatalogFacets = {
  hasPerfumes: boolean;
  hasClothing: boolean;
  brands: string[];
  volumes: number[];
  sizes: string[];
  colors: string[];
};

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

function sizeRank(size: string) {
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

/** Distinct filter values present in a set of products (only for the matching type). */
export function collectFacets(rows: FacetRow[]): CatalogFacets {
  const brands = new Set<string>();
  const volumes = new Set<number>();
  const sizes = new Set<string>();
  const colors = new Set<string>();
  let hasPerfumes = false;
  let hasClothing = false;

  for (const row of rows) {
    if (row.type === "PERFUME") {
      hasPerfumes = true;
      if (row.brand) brands.add(row.brand);
      for (const v of row.variants) {
        const o = v.options as { volumeMl?: unknown } | null;
        if (typeof o?.volumeMl === "number") volumes.add(o.volumeMl);
      }
    }
    if (row.type === "CLOTHING") {
      hasClothing = true;
      for (const v of row.variants) {
        const o = v.options as { size?: unknown; color?: unknown } | null;
        if (typeof o?.size === "string" && o.size) sizes.add(o.size);
        if (typeof o?.color === "string" && o.color) colors.add(o.color);
      }
    }
  }

  return {
    hasPerfumes,
    hasClothing,
    brands: [...brands].sort((a, b) => a.localeCompare(b, "fr")),
    volumes: [...volumes].sort((a, b) => a - b),
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b, "fr")),
    colors: [...colors].sort((a, b) => a.localeCompare(b, "fr")),
  };
}
