import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t } from "@/lib/strings";

export type Crumb = { label: string; href?: string };

/** The last crumb is the current page (no link). Home is always prepended. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: t.shop.breadcrumbs.home, href: "/" }, ...items];
  return (
    <nav aria-label={t.shop.breadcrumbs.label} className="text-muted-foreground text-sm">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {all.map((crumb, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-foreground hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-foreground" : ""}
                >
                  {crumb.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
