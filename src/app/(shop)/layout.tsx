import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartProvider } from "@/components/shop/cart-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import { t } from "@/lib/strings";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <CartProvider>
      <a
        href="#contenu"
        className="bg-background focus:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2"
      >
        {t.shop.skipToContent}
      </a>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <SiteFooter />
      <Toaster richColors position="top-center" />
      <CartDrawer />
    </CartProvider>
  );
}
