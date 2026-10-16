import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs, type Crumb } from "@/components/shop/breadcrumbs";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductGrid, ProductGridSkeleton } from "@/components/shop/product-grid";
import { ProductInfoBlock } from "@/components/shop/product-info-block";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { buildProductJsonLd, metaDescription, serializeJsonLd } from "@/lib/product-jsonld";
import { SITE_URL } from "@/lib/site";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import {
  getProductBySlug,
  getProductSlugsForPrerender,
  getRelatedProducts,
  type ProductDetail,
} from "@/server/storefront";

const s = t.shop.product;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Cache Components needs at least one sample slug to prerender the route shell. Unknown slugs are
// answered by the proxy (src/proxy.ts) with a real 404. When the catalog is empty a placeholder is used.
export async function generateStaticParams() {
  const slugs = await getProductSlugsForPrerender();
  return (slugs.length > 0 ? slugs : ["produit-exemple"]).map((slug) => ({ slug }));
}

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  if (slug.length > 120 || !SLUG_PATTERN.test(slug)) return null;
  return getProductBySlug(slug);
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: s.notFoundTitle, robots: { index: false } };

  const description = metaDescription(
    product.description,
    format(s.metaFallback, { name: product.name }),
  );
  const url = `${SITE_URL}/p/${product.slug}`;
  const cover = product.images[0]?.url;
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url,
      ...(cover && { images: [{ url: cover, alt: product.name }] }),
    },
  };
}

async function RelatedProducts({ product }: { product: ProductDetail }) {
  const related = await getRelatedProducts(product.id, product.categoryId);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="space-y-4">
      <h2 id="related-title" className="text-xl font-semibold">
        {s.related}
      </h2>
      <ProductGrid products={related} />
    </section>
  );
}

// `params` is read inside Suspense: after a catalog cache invalidation (every order, every admin
// edit) Next re-renders the route and refuses (HTTP 500) to read params outside a boundary.
// Real 404s for unknown slugs still come from the proxy, which rewrites them before rendering.
export default function ProductPage(props: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={4} />}>
      <ProductContent {...props} />
    </Suspense>
  );
}

async function ProductContent({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const { category } = product;
  const crumbs: Crumb[] = [
    ...(category.parent
      ? [{ label: category.parent.name, href: `/c/${category.parent.slug}` }]
      : []),
    { label: category.name, href: `/c/${category.slug}` },
    { label: product.name },
  ];

  const jsonLd = buildProductJsonLd({
    name: product.name,
    description: product.description,
    brand: product.brand,
    images: product.images.map((image) => image.url),
    url: `${SITE_URL}/p/${product.slug}`,
    variants: product.variants,
  });

  return (
    <div className="space-y-10">
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-10">
        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-5">
          <div className="space-y-1">
            {product.brand && (
              <p className="text-muted-foreground text-sm tracking-wide uppercase">
                {product.brand}
              </p>
            )}
            <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">{product.name}</h1>
          </div>
          <ProductPurchase type={product.type} variants={product.variants} />
          <ProductInfoBlock />
        </div>
      </div>

      {product.description.trim() && (
        <section aria-labelledby="description-title" className="max-w-prose space-y-2">
          <h2 id="description-title" className="text-xl font-semibold">
            {s.description}
          </h2>
          {/* Plain text only: React escapes it, whitespace-pre-line keeps the line breaks. */}
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </section>
      )}

      <Suspense fallback={<ProductGridSkeleton count={4} />}>
        <RelatedProducts product={product} />
      </Suspense>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </div>
  );
}
