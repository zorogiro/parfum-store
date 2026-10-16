import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { pageWindow } from "@/lib/catalog-query";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";

const s = t.shop.listing;

/** Link-based pagination: works without JS and every page has a shareable URL. */
export function Pagination({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={s.pagination} className="mt-10 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          rel="prev"
          aria-label={s.previous}
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <ChevronLeft />
        </Link>
      ) : (
        <span
          aria-hidden
          className={
            buttonVariants({ variant: "outline", size: "icon-lg" }) +
            " pointer-events-none opacity-40"
          }
        >
          <ChevronLeft />
        </span>
      )}
      {pageWindow(page, pageCount).map((entry, i) =>
        entry === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="text-muted-foreground px-1">
            …
          </span>
        ) : entry === page ? (
          <span
            key={entry}
            aria-current="page"
            aria-label={format(s.currentPage, { page: entry, count: pageCount })}
            className={buttonVariants({ size: "icon-lg" })}
          >
            {entry}
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefForPage(entry)}
            aria-label={format(s.page, { page: entry })}
            className={buttonVariants({ variant: "outline", size: "icon-lg" })}
          >
            {entry}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link
          href={hrefForPage(page + 1)}
          rel="next"
          aria-label={s.next}
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <ChevronRight />
        </Link>
      ) : (
        <span
          aria-hidden
          className={
            buttonVariants({ variant: "outline", size: "icon-lg" }) +
            " pointer-events-none opacity-40"
          }
        >
          <ChevronRight />
        </span>
      )}
    </nav>
  );
}
