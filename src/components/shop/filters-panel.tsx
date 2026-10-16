"use client";

import { useId, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  activeFilterCount,
  buildListingHref,
  hasActiveFilters,
  priceParam,
  withoutFilters,
  type ListingFilters,
} from "@/lib/catalog-query";
import type { CatalogFacets } from "@/lib/product-card-data";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";

const s = t.shop.listing;

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  idPrefix,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  idPrefix: string;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      {options.map((option) => {
        const id = `${idPrefix}-${name}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm"
          >
            <input
              id={id}
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="accent-primary size-4"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

function FilterForm({
  basePath,
  filters,
  facets,
  q,
  idPrefix,
  onSubmit,
}: {
  basePath: string;
  filters: ListingFilters;
  facets: CatalogFacets;
  q?: string;
  idPrefix: string;
  onSubmit?: () => void;
}) {
  const resetHref = buildListingHref(basePath, withoutFilters(filters), { q });
  // Brands / sizes / colors already selected in the URL stay visible even if no longer offered.
  const merge = (all: string[], selected: string[]) => [...new Set([...all, ...selected])];

  return (
    <Form action={basePath} onSubmit={onSubmit} className="space-y-6">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{s.priceRange}</legend>
        <div className="flex items-center gap-2">
          <input
            name="min"
            inputMode="decimal"
            maxLength={12}
            placeholder={s.priceMin}
            aria-label={`${s.priceRange} – ${s.priceMin}`}
            defaultValue={filters.minPrice !== undefined ? priceParam(filters.minPrice) : ""}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:ring-3 sm:text-sm"
          />
          <span aria-hidden>–</span>
          <input
            name="max"
            inputMode="decimal"
            maxLength={12}
            placeholder={s.priceMax}
            aria-label={`${s.priceRange} – ${s.priceMax}`}
            defaultValue={filters.maxPrice !== undefined ? priceParam(filters.maxPrice) : ""}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:ring-3 sm:text-sm"
          />
        </div>
      </fieldset>

      <label
        htmlFor={`${idPrefix}-stock`}
        className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm font-medium"
      >
        <input
          id={`${idPrefix}-stock`}
          type="checkbox"
          name="stock"
          value="1"
          defaultChecked={filters.inStock}
          className="accent-primary size-4"
        />
        {s.inStockOnly}
      </label>

      {facets.hasPerfumes && (
        <>
          <CheckboxGroup
            legend={s.brand}
            name="brand"
            idPrefix={idPrefix}
            selected={filters.brands}
            options={merge(facets.brands, filters.brands).map((b) => ({ value: b, label: b }))}
          />
          <CheckboxGroup
            legend={s.volume}
            name="volume"
            idPrefix={idPrefix}
            selected={filters.volumes.map(String)}
            options={[...new Set([...facets.volumes, ...filters.volumes])]
              .sort((a, b) => a - b)
              .map((v) => ({ value: String(v), label: format(s.volumeValue, { value: v }) }))}
          />
        </>
      )}
      {facets.hasClothing && (
        <>
          <CheckboxGroup
            legend={s.size}
            name="size"
            idPrefix={idPrefix}
            selected={filters.sizes}
            options={merge(facets.sizes, filters.sizes).map((v) => ({ value: v, label: v }))}
          />
          <CheckboxGroup
            legend={s.color}
            name="color"
            idPrefix={idPrefix}
            selected={filters.colors}
            options={merge(facets.colors, filters.colors).map((v) => ({ value: v, label: v }))}
          />
        </>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="h-10">
          {s.applyFilters}
        </Button>
        {hasActiveFilters(filters) && (
          <Link
            href={resetHref}
            onClick={onSubmit}
            className={buttonVariants({ variant: "outline", size: "lg", className: "h-10" })}
          >
            {s.resetFilters}
          </Link>
        )}
      </div>
    </Form>
  );
}

type PanelProps = {
  basePath: string;
  filters: ListingFilters;
  facets: CatalogFacets;
  q?: string;
};

/** Sidebar shown from `lg`. The form re-mounts when the URL state changes so defaults follow the URL. */
export function FiltersSidebar({ basePath, filters, facets, q }: PanelProps) {
  const uid = useId();
  return (
    <aside aria-label={s.filters} className="hidden w-64 shrink-0 lg:block">
      <h2 className="mb-4 text-base font-semibold">{s.filters}</h2>
      <FilterForm
        key={buildListingHref(basePath, filters, { q })}
        basePath={basePath}
        filters={filters}
        facets={facets}
        q={q}
        idPrefix={`${uid}-d`}
      />
    </aside>
  );
}

/** Button + drawer shown below `lg`. */
export function FiltersDrawer({ basePath, filters, facets, q }: PanelProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const count = activeFilterCount(filters);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-10 gap-2 px-3",
          })}
        >
          <SlidersHorizontal aria-hidden />
          {count > 0 ? format(s.filtersWithCount, { count }) : s.filters}
        </SheetTrigger>
        <SheetContent side="right" closeLabel={s.closeFilters}>
          <div className="border-b px-4 py-3">
            <SheetTitle>{s.filters}</SheetTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <FilterForm
              key={buildListingHref(basePath, filters, { q })}
              basePath={basePath}
              filters={filters}
              facets={facets}
              q={q}
              idPrefix={`${uid}-m`}
              onSubmit={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
