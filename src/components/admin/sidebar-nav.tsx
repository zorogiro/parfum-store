"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { t } from "@/lib/strings";

const items = [
  { href: "/admin", label: t.admin.nav.dashboard },
  { href: "/admin/products", label: t.admin.nav.products },
  { href: "/admin/categories", label: t.admin.nav.categories },
  { href: "/admin/orders", label: t.admin.nav.orders },
  { href: "/admin/shipping", label: t.admin.nav.shipping },
  { href: "/admin/settings", label: t.admin.nav.settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium",
              active && "bg-muted",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
