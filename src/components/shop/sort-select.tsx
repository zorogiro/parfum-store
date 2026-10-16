"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import {
  buildListingHref,
  SORT_OPTIONS,
  type ListingFilters,
  type SortOption,
} from "@/lib/catalog-query";
import { t } from "@/lib/strings";

const s = t.shop.listing;

/** Changing the sort keeps every filter and goes back to page 1. */
export function SortSelect({
  basePath,
  filters,
  q,
}: {
  basePath: string;
  filters: ListingFilters;
  q?: string;
}) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-muted-foreground hidden text-sm sm:block">
        {s.sortBy}
      </label>
      <select
        id={id}
        aria-label={s.sortBy}
        value={filters.sort}
        onChange={(e) => {
          router.push(
            buildListingHref(
              basePath,
              { ...filters, sort: e.target.value as SortOption, page: 1 },
              { q },
            ),
          );
        }}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {s.sort[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
