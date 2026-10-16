"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { t } from "@/lib/strings";
import { useCart } from "./cart-provider";

const s = t.shop.cart;

/**
 * Cart actions for the product page.
 *   addItem(variantId, quantity): the caller passes a valid variant id and a quantity already
 *   clamped to min(stock, 10). The cart view still re-validates stock and prices on the server.
 */
export function useCartActions() {
  const { addItem: add, openDrawer } = useCart();

  const addItem = useCallback(
    (variantId: string, quantity: number) => {
      const outcome = add(variantId, quantity);
      if (outcome === "full") {
        toast.error(s.full);
      } else if (outcome === "capped") {
        toast.warning(s.maxQuantity, {
          action: { label: s.viewCart, onClick: openDrawer },
        });
      } else {
        toast.success(s.added, { action: { label: s.viewCart, onClick: openDrawer } });
      }
    },
    [add, openDrawer],
  );

  return { addItem };
}
