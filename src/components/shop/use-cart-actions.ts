"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { t } from "@/lib/strings";

/**
 * PLACEHOLDER until the cart exists (Task 6): shows a toast and does nothing else.
 *
 * Task 6 replaces the BODY of this hook (read/write the cart context, open the drawer, toast
 * "added"). The contract below must stay the same so the product page needs no change:
 *   addItem(variantId, quantity): the caller passes a valid variant id and a quantity already
 *   clamped to min(stock, 10). The cart must still re-validate stock and prices on the server.
 */
export function useCartActions() {
  const addItem = useCallback((variantId: string, quantity: number) => {
    void variantId;
    void quantity;
    toast.info(t.shop.cart.comingSoon);
  }, []);

  return { addItem };
}
