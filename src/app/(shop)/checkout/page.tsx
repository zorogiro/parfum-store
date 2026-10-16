import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";
import { t } from "@/lib/strings";
import { getShippingZones } from "@/server/storefront";

export const metadata: Metadata = {
  title: t.shop.checkout.metaTitle,
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const zones = await getShippingZones();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.shop.checkout.title}</h1>
      <CheckoutView zones={zones} />
    </div>
  );
}
