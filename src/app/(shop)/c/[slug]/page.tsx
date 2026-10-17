import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs, type Crumb } from "@/components/shop/breadcrumbs";
import { ListingSkeleton } from "@/components/shop/listing-skeleton";
import { ListingView } from "@/components/shop/listing-view";
import { parseListingParams } from "@/lib/catalog-query";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import {
  getCategoryBySlug,
  getCategoryFacets,
  getCategoryListing,
  getCategorySlugsForPrerender,
  type CategoryInfo,
} from "@/server/storefront";

const s = t.shop;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Cache Components needs at least one sample slug to prerender the route shell. Unknown slugs
// are rendered on demand; the proxy (src/proxy.ts) answers them with a real 404.
export async function generateStaticParams() {
  const slugs = await getCategorySlugsForPrerender();
  return (slugs.length > 0 ? slugs : ["categorie-exemple"]).map((slug) => ({ slug }));
}

async function loadCategory(slug: string) {
  if (slug.length > 100 || !SLUG_PATTERN.test(slug)) return null;
  return getCategoryBySlug(slug);
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: s.category.notFoundTitle, robots: { index: false } };

  const description = format(s.category.metaDescription, { name: category.name });
  const url = `/c/${category.slug}`;
  return {
    title: category.name,
    description,
    // Filtered / sorted / paginated variants all point at the plain category URL.
    alternates: { canonical: url },
    openGraph: {
      title: category.name,
      description,
      url,
      ...(category.image && { images: [{ url: category.image }] }),
    },
  };
}

async function CategoryContent({
  category,
  searchParams,
}: {
  category: CategoryInfo;
  searchParams: PageProps<"/c/[slug]">["searchParams"];
}) {
  const filters = parseListingParams(await searchParams);
  const [result, facets] = await Promise.all([
    getCategoryListing(category.categoryIds, filters),
    getCategoryFacets(category.categoryIds),
  ]);

  const crumbs: Crumb[] = [
    ...(category.parent
      ? [{ label: category.parent.name, href: `/c/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumbs items={crumbs} />
      <h1 className="text-2xl font-semibold sm:text-3xl">{category.name}</h1>

      {category.children.length > 0 && (
        <nav aria-label={s.listing.subcategories}>
          <ul className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/c/${child.slug}`}
                  className="hover:bg-muted inline-flex h-9 items-center rounded-full border px-4 text-sm"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ListingView
        basePath={`/c/${category.slug}`}
        filters={filters}
        result={result}
        facets={facets}
        emptyText={s.listing.emptyCategory}
      />
    </div>
  );
}

// `params` is read inside Suspense: after a catalog cache invalidation (every order, every admin
// edit) Next re-renders the route and refuses (HTTP 500) to read params outside a boundary.
// Real 404s for unknown slugs still come from the proxy, which rewrites them before rendering.
export default function CategoryPage(props: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CategoryLoader {...props} />
    </Suspense>
  );
}

async function CategoryLoader({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();
  return <CategoryContent category={category} searchParams={searchParams} />;
}
