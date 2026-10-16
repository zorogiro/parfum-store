import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { t } from "@/lib/strings";

export const metadata: Metadata = {
  title: t.shop.cart.title,
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.shop.cart.title}</h1>
      <CartView layout="page" />
    </div>
  );
}
