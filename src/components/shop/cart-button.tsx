"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { format } from "@/lib/utils";
import { t } from "@/lib/strings";
import { useCart } from "./cart-provider";
import { useCartItemCount } from "./use-cart-item-count";

const s = t.shop.header;

/**
 * Header cart icon with the item count. Opens the cart drawer; the link to /cart is the
 * fallback (no JS, modified clicks) and is used as is when already on /cart.
 */
export function CartButton() {
  const count = useCartItemCount();
  const { openDrawer, isHydrated } = useCart();
  const pathname = usePathname();
  return (
    <Link
      href="/cart"
      prefetch={false}
      data-hydrated={isHydrated}
      aria-label={format(s.cartCount, { count })}
      onClick={(e) => {
        if (pathname === "/cart" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openDrawer();
      }}
      className="hover:bg-muted focus-visible:ring-ring/50 relative flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-3"
    >
      <ShoppingBag className="size-5" aria-hidden />
      <span
        aria-hidden
        data-testid="cart-badge"
        className="bg-primary text-primary-foreground absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold"
      >
        {count}
      </span>
    </Link>
  );
}
