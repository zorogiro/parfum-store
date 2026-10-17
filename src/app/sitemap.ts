import type { MetadataRoute } from "next";
import { LEGAL_LINKS, SITE_URL } from "@/lib/site";
import { getSitemapData } from "@/server/storefront";

/**
 * Generated from the database: home, every category, ACTIVE products (with lastModified) and
 * the legal pages. Cart, checkout, order, tracking, search and /admin are never listed.
 * Refreshed when the `catalog` cache tag is invalidated (admin edits, orders).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { categories, products } = await getSitemapData();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/c/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...LEGAL_LINKS.map((l) => ({
      url: `${SITE_URL}${l.href}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
