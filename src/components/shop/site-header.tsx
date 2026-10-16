import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getMenuCategories } from "@/server/storefront";
import { t } from "@/lib/strings";
import { CartButton } from "./cart-button";
import { MobileMenu } from "./mobile-menu";
import { SearchToggle } from "./search-toggle";

const s = t.shop.header;

async function DesktopNav() {
  const categories = await getMenuCategories();
  return (
    <nav aria-label={s.mainNav} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {categories.map((category) => (
          <li key={category.id} className="group relative">
            <Link
              href={`/c/${category.slug}`}
              className="hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-3"
            >
              {category.name}
              {category.children.length > 0 && (
                <ChevronDown className="size-3.5 opacity-60" aria-hidden />
              )}
            </Link>
            {category.children.length > 0 && (
              <ul className="bg-popover invisible absolute top-full left-0 z-40 min-w-52 rounded-lg border p-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/c/${child.slug}`}
                      className="hover:bg-muted block rounded-md px-3 py-2 text-sm"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function MobileNav() {
  return <MobileMenu categories={await getMenuCategories()} />;
}

export function SiteHeader() {
  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:px-4 lg:h-16">
        <Suspense fallback={<div className="size-10 lg:hidden" />}>
          <MobileNav />
        </Suspense>
        <Link
          href="/"
          aria-label={s.home}
          className="focus-visible:ring-ring/50 mr-2 rounded-md px-2 py-1 text-lg font-semibold tracking-tight outline-none focus-visible:ring-3"
        >
          {t.site.name}
        </Link>
        <Suspense fallback={<div className="hidden flex-1 lg:block" />}>
          <DesktopNav />
        </Suspense>
        <div className="ml-auto flex items-center">
          <SearchToggle />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
