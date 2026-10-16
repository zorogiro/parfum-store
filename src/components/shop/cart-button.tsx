"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { format } from "@/lib/utils";
import { t } from "@/lib/strings";
import { useCartItemCount } from "./use-cart-item-count";

const s = t.shop.header;

/** Header cart icon with the item count. Task 6: link it to the cart drawer / /cart page. */
export function CartButton() {
  const count = useCartItemCount();
  return (
    <Link
      href="/cart"
      prefetch={false}
      aria-label={format(s.cartCount, { count })}
      className="hover:bg-muted focus-visible:ring-ring/50 relative flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-3"
    >
      <ShoppingBag className="size-5" aria-hidden />
      <span
        aria-hidden
        className="bg-primary text-primary-foreground absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold"
      >
        {count}
      </span>
    </Link>
  );
}
