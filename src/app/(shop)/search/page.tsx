import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { EmptyState } from "@/components/shop/empty-state";
import { ListingSkeleton } from "@/components/shop/listing-skeleton";
import { ListingView } from "@/components/shop/listing-view";
import { MAX_SEARCH_LENGTH, parseListingParams, parseSearchQuery } from "@/lib/catalog-query";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import { searchProducts } from "@/server/storefront";

const s = t.shop.search;

// Internal search results are not indexed; the catalog pages are.
export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = parseSearchQuery((await searchParams).q);
  return {
    title: q ? format(s.resultsFor, { q }) : s.allTitle,
    description: s.metaDescription,
    robots: { index: false, follow: true },
  };
}

async function SearchContent({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const q = parseSearchQuery(raw.q);
  const filters = parseListingParams(raw);
  const result = await searchProducts(q, filters);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: q ? s.title : s.allTitle }]} />
      <h1 className="text-2xl font-semibold sm:text-3xl">
        {q ? format(s.resultsFor, { q }) : s.allTitle}
      </h1>

      <Form action="/search" role="search" className="flex max-w-xl gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={s.placeholder}
          aria-label={s.title}
          enterKeyHint="search"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:ring-3"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium"
        >
          <Search className="size-4" aria-hidden />
          {s.submit}
        </button>
      </Form>

      {q && result.total === 0 ? (
        <EmptyState
          title={format(s.emptyTitle, { q })}
          text={s.emptyText}
          actionLabel={s.seeAll}
          actionHref="/search"
        />
      ) : (
        <ListingView
          basePath="/search"
          filters={filters}
          result={result}
          q={q || undefined}
          emptyText={t.shop.listing.emptyCategory}
        />
      )}
    </div>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <SearchContent {...props} />
    </Suspense>
  );
}
