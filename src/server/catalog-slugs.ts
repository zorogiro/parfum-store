import { db } from "@/lib/db";
import { logServerError } from "./log";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;

/** Hits are remembered per server instance for a minute; misses always go to the database. */
const HIT_TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const hits = new Map<string, number>();

export type SlugKind = "product" | "category";

/**
 * Cheap existence check used by the proxy to answer unknown /p/[slug] and /c/[slug] URLs with a
 * real 404 before the page renders (a page that only calls notFound() cannot change the status
 * once Cache Components has served the prerendered shell). Products must be active.
 * Fails open on database errors: the page then makes the final decision.
 */
export async function catalogSlugExists(kind: SlugKind, slug: string): Promise<boolean> {
  if (slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) return false;

  const key = `${kind}:${slug}`;
  const now = Date.now();
  const expires = hits.get(key);
  if (expires !== undefined && expires > now) return true;

  try {
    const found =
      kind === "product"
        ? await db.product.findFirst({ where: { slug, isActive: true }, select: { id: true } })
        : await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (!found) {
      hits.delete(key);
      return false;
    }
    if (hits.size >= MAX_ENTRIES) hits.clear();
    hits.set(key, now + HIT_TTL_MS);
    return true;
  } catch (error) {
    logServerError("catalogSlugExists", error);
    return true;
  }
}
