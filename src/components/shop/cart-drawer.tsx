"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { t } from "@/lib/strings";
import { CartView } from "./cart-view";
import { useCart } from "./cart-provider";

const s = t.shop.cart;

/** Right-hand cart drawer. CartView only mounts while open, so each opening reads fresh data. */
export function CartDrawer() {
  const { isDrawerOpen, closeDrawer, itemCount } = useCart();
  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" closeLabel={s.closeDrawer} className="w-[92vw] max-w-md">
        <div className="border-b px-4 py-3">
          <SheetTitle>
            {s.title}
            {itemCount > 0 && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">({itemCount})</span>
            )}
          </SheetTitle>
        </div>
        <CartView layout="drawer" onNavigate={closeDrawer} />
      </SheetContent>
    </Sheet>
  );
}
