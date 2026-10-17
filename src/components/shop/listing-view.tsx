import {
  buildListingHref,
  hasActiveFilters,
  withoutFilters,
  type ListingFilters,
} from "@/lib/catalog-query";
import type { CatalogFacets } from "@/lib/product-card-data";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import type { ListingResult } from "@/server/storefront";
import { EmptyState } from "./empty-state";
import { FiltersDrawer, FiltersSidebar } from "./filters-panel";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";
import { SortSelect } from "./sort-select";

const s = t.shop.listing;

/**
 * Toolbar + grid + pagination shared by category and search pages.
 * `facets` enables the filters UI (category pages only).
 */
export function ListingView({
  basePath,
  filters,
  result,
  facets,
  q,
  emptyText,
}: {
  basePath: string;
  filters: ListingFilters;
  result: ListingResult;
  facets?: CatalogFacets;
  q?: string;
  /** Message when nothing matches and no filter is active. */
  emptyText: string;
}) {
  const filtered = hasActiveFilters(filters);
  const hrefForPage = (page: number) => buildListingHref(basePath, { ...filters, page }, { q });

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      {facets && <FiltersSidebar basePath={basePath} filters={filters} facets={facets} q={q} />}

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          {facets && <FiltersDrawer basePath={basePath} filters={filters} facets={facets} q={q} />}
          <p className="text-muted-foreground text-sm whitespace-nowrap" aria-live="polite">
            {format(result.total === 1 ? s.productCountOne : s.productCount, {
              count: result.total,
            })}
          </p>
          <div className="ml-auto">
            <SortSelect basePath={basePath} filters={filters} q={q} />
          </div>
        </div>

        {result.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title={s.emptyTitle}
              text={s.emptyFiltered}
              actionLabel={s.resetFilters}
              actionHref={buildListingHref(basePath, withoutFilters(filters), { q })}
            />
          ) : (
            <EmptyState
              title={s.emptyTitle}
              text={emptyText}
              actionLabel={s.backHome}
              actionHref="/"
            />
          )
        ) : (
          <>
            <ProductGrid products={result.items} eagerCount={4} headingLevel={2} />
            <Pagination page={result.page} pageCount={result.pageCount} hrefForPage={hrefForPage} />
          </>
        )}
      </div>
    </div>
  );
}
