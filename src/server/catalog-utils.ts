import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

/** Thrown inside a transaction to roll it back with a user-facing French message. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Which unique column a P2002 refers to. The shape of `meta` differs between the
 * Rust engine and driver adapters, so look at everything we have.
 */
export function uniqueViolation(error: unknown): "slug" | "sku" | "other" | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const haystack = `${JSON.stringify(error.meta ?? {})} ${error.message}`.toLowerCase();
  if (haystack.includes("slug")) return "slug";
  if (haystack.includes("sku")) return "sku";
  return "other";
}

/** Call from server actions only (updateTag is not available in route handlers). */
export function revalidateCatalog() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout"); // storefront pages
  updateTag("catalog"); // cached storefront queries (src/server/storefront.ts)
}
