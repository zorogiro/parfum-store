"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MenuCategory } from "@/server/storefront";
import { t } from "@/lib/strings";

const s = t.shop.header;

/** Burger menu (below the `lg` breakpoint): categories with their subcategories. */
export function MobileMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={s.openMenu}
        className="hover:bg-muted focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-3 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" closeLabel={s.closeMenu}>
        <div className="border-b px-4 py-3">
          <SheetTitle>{s.menu}</SheetTitle>
        </div>
        <nav aria-label={s.mainNav} className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            <li>
              <Link
                href="/"
                onClick={close}
                className="hover:bg-muted block rounded-lg px-3 py-2.5 font-medium"
              >
                {t.shop.breadcrumbs.home}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/c/${category.slug}`}
                  onClick={close}
                  className="hover:bg-muted block rounded-lg px-3 py-2.5 font-medium"
                >
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <ul className="border-border mb-1 ml-4 space-y-0.5 border-l pl-2">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/c/${child.slug}`}
                          onClick={close}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-lg px-3 py-2 text-sm"
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
      </SheetContent>
    </Sheet>
  );
}
