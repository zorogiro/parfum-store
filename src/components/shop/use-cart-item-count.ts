"use client";

import { useCart } from "./cart-provider";

/** Number of items in the cart (sum of quantities). 0 until the client has hydrated. */
export function useCartItemCount(): number {
  return useCart().itemCount;
}
