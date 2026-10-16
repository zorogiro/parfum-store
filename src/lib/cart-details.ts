import { MAX_QUANTITY } from "@/lib/product-variants";

/**
 * Shape returned by the public `getCartDetails` action, plus the pure rules behind it.
 * No React or DB imports.
 */
export type CartLineStatus = "OK" | "OUT_OF_STOCK" | "REDUCED" | "UNAVAILABLE";

export type CartLineDetail =
  | {
      variantId: string;
      status: "OK" | "OUT_OF_STOCK" | "REDUCED";
      productName: string;
      productSlug: string;
      variantLabel: string;
      imageUrl: string | null;
      /** Millimes. */
      unitPrice: number;
      /** Millimes. */
      compareAtPrice: number | null;
      /** min(stock, 10). The exact stock is never exposed above 10. */
      availableQuantity: number;
    }
  // Variant or product deleted or inactive: nothing about it is revealed.
  | { variantId: string; status: "UNAVAILABLE" };

export type CartDetails = {
  lines: CartLineDetail[];
  /** Millimes. null / 0 = free shipping disabled. */
  freeShippingThreshold: number | null;
};

export function lineStatus(
  requested: number,
  stock: number,
): { status: "OK" | "OUT_OF_STOCK" | "REDUCED"; availableQuantity: number } {
  const availableQuantity = Math.max(0, Math.min(stock, MAX_QUANTITY));
  if (stock <= 0) return { status: "OUT_OF_STOCK", availableQuantity: 0 };
  if (requested > stock) return { status: "REDUCED", availableQuantity };
  return { status: "OK", availableQuantity };
}

/** Quantity to show/charge for a line: the requested one, lowered to what is available. */
export function effectiveQuantity(line: CartLineDetail, requested: number): number {
  if (line.status === "UNAVAILABLE" || line.status === "OUT_OF_STOCK") return 0;
  return Math.min(requested, line.availableQuantity);
}

/** Parses the freeShippingThreshold setting (millimes as text). null when missing/invalid/0. */
export function parseThresholdSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}
