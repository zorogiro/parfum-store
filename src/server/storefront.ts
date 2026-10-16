import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildFilterWhere,
  buildSearchWhere,
  paginate,
  sortByMinPrice,
  type ListingFilters,
} from "@/lib/catalog-query";
import { db } from "@/lib/db";
import {
  collectFacets,
  toProductCardData,
  type CatalogFacets,
  type ProductCardData,
} from "@/lib/product-card-data";

/**
 * Read-only storefront queries. Every query only returns active products.
 * Cached with the `catalog` tag: admin product/category actions call `updateTag("catalog")`
 * (see revalidateCatalog) and the order flow must do the same when stock changes.
 */
export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "settings";

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  variants: { select: { price: true, compareAtPrice: true, stock: true } },
} satisfies Prisma.ProductSelect;

export type ListingResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

export async function getMenuCategories(): Promise<MenuCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const roots = await db.category.findMany({
    where: { parentId: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      },
    },
  });
  return roots;
}

export async function getStorePhone(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);

  const row = await db.setting.findUnique({ where: { key: "storePhone" } });
  return row?.value.trim() || null;
}

export type FeaturedCategory = { id: string; name: string; slug: string; imageUrl: string | null };

/** Root categories for the home page. Falls back to the cover of a recent product when no image is set. */
export async function getFeaturedCategories(): Promise<FeaturedCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const roots = await db.category.findMany({
    where: { parentId: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    take: 4,
    select: { id: true, name: true, slug: true, image: true, children: { select: { id: true } } },
  });

  return Promise.all(
    roots.map(async (root) => {
      let imageUrl = root.image;
      if (!imageUrl) {
        const product = await db.product.findFirst({
          where: {
            isActive: true,
            categoryId: { in: [root.id, ...root.children.map((c) => c.id)] },
            images: { some: {} },
          },
          orderBy: { createdAt: "desc" },
          select: { images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
        });
        imageUrl = product?.images[0]?.url ?? null;
      }
      return { id: root.id, name: root.name, slug: root.slug, imageUrl };
    }),
  );
}

export async function getLatestProducts(limit: number): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toProductCardData);
}

export type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  parent: { name: string; slug: string } | null;
  children: { name: string; slug: string }[];
  /** The category itself plus its subcategories. */
  categoryIds: string[];
};

export async function getCategoryBySlug(slug: string): Promise<CategoryInfo | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const category = await db.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      parent: { select: { name: true, slug: true } },
      children: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      },
    },
  });
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    parent: category.parent,
    children: category.children.map((c) => ({ name: c.name, slug: c.slug })),
    categoryIds: [category.id, ...category.children.map((c) => c.id)],
  };
}

export async function getCategoryFacets(categoryIds: string[]): Promise<CatalogFacets> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const rows = await db.product.findMany({
    where: { isActive: true, categoryId: { in: categoryIds } },
    select: { type: true, brand: true, variants: { select: { options: true } } },
  });
  return collectFacets(rows);
}

/**
 * Runs a filtered, sorted and paginated listing.
 * - "newest" is sorted and paginated by the database.
 * - Price sorts use the lowest variant price, which Prisma can't order by, so ids + prices
 *   of the matching products are sorted in memory and only the requested page is loaded.
 *   Fine for an MVP catalog; switch to a materialised min-price column if it grows large.
 */
async function runListing(
  where: Prisma.ProductWhereInput,
  filters: ListingFilters,
): Promise<ListingResult> {
  const total = await db.product.count({ where });
  const { page, pageCount, skip, take } = paginate(filters.page, total);

  if (filters.sort === "newest") {
    const rows = await db.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
      select: cardSelect,
    });
    return { items: rows.map(toProductCardData), total, page, pageCount };
  }

  const priced = await db.product.findMany({
    where,
    select: { id: true, variants: { select: { price: true } } },
  });
  const sorted = sortByMinPrice(
    priced.map((p) => ({
      id: p.id,
      minPrice: p.variants.length > 0 ? Math.min(...p.variants.map((v) => v.price)) : null,
    })),
    filters.sort === "price_asc" ? "asc" : "desc",
  );
  const ids = sorted.slice(skip, skip + take).map((r) => r.id);
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProductCardData(row)] : [];
  });
  return { items, total, page, pageCount };
}

export async function getCategoryListing(
  categoryIds: string[],
  filters: ListingFilters,
): Promise<ListingResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  return runListing(
    { AND: [{ isActive: true, categoryId: { in: categoryIds } }, buildFilterWhere(filters)] },
    filters,
  );
}

/** Not cached: queries are free text, so cache keys would be unbounded. */
export async function searchProducts(q: string, filters: ListingFilters): Promise<ListingResult> {
  return runListing({ AND: [{ isActive: true }, buildSearchWhere(q)] }, filters);
}
