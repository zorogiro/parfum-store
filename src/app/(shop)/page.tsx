import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Banknote, PhoneCall, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductGrid, ProductGridSkeleton } from "@/components/shop/product-grid";
import { t } from "@/lib/strings";
import { getFeaturedCategories, getLatestProducts } from "@/server/storefront";

const s = t.shop.home;

export const metadata: Metadata = {
  title: { absolute: `${t.site.name} – ${s.metaTitle}` },
  description: t.site.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${t.site.name} – ${s.metaTitle}`,
    description: t.site.description,
    url: "/",
  },
};

async function FeaturedCategories() {
  const categories = await getFeaturedCategories();
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="home-categories" className="space-y-4">
      <h2 id="home-categories" className="text-xl font-semibold sm:text-2xl">
        {s.categoriesTitle}
      </h2>
      <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:gap-4">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/c/${category.slug}`}
              className="group focus-visible:ring-ring/50 bg-muted relative block aspect-[16/9] overflow-hidden rounded-xl outline-none focus-visible:ring-3 min-[480px]:aspect-[4/5]"
            >
              {category.imageUrl && (
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1152px) 22rem, (min-width: 480px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-lg font-semibold">{category.name}</p>
                <p className="text-sm text-white/80 underline-offset-4 group-hover:underline">
                  {s.categoryCta}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function LatestProducts() {
  const products = await getLatestProducts(8);
  if (products.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        {s.newEmpty}
      </p>
    );
  }
  return <ProductGrid products={products} />;
}

const TRUST = [
  { icon: Banknote, ...s.trust.cod },
  { icon: Truck, ...s.trust.delivery },
  { icon: PhoneCall, ...s.trust.confirmation },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="bg-primary text-primary-foreground -mx-4 -mt-6 px-4 py-14 sm:mx-0 sm:mt-0 sm:rounded-2xl sm:px-10 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-5 text-center">
          <p className="text-sm tracking-wide text-white/70 uppercase">{s.heroEyebrow}</p>
          <h1 className="text-3xl leading-tight font-semibold text-balance sm:text-5xl">
            {s.heroTitle}
          </h1>
          <p className="text-base text-balance text-white/80 sm:text-lg">{s.heroText}</p>
          <Link
            href="/search"
            className={buttonVariants({
              variant: "secondary",
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            {s.heroCta}
          </Link>
        </div>
      </section>

      <Suspense fallback={<div className="bg-muted h-48 animate-pulse rounded-xl" aria-hidden />}>
        <FeaturedCategories />
      </Suspense>

      <section aria-labelledby="home-new" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="home-new" className="text-xl font-semibold sm:text-2xl">
            {s.newTitle}
          </h2>
          <Link href="/search" className="text-sm font-medium underline-offset-4 hover:underline">
            {s.seeAll}
          </Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <LatestProducts />
        </Suspense>
      </section>

      <section aria-label={s.trust.cod.title}>
        <ul className="bg-muted/50 grid gap-4 rounded-2xl p-5 sm:grid-cols-3 sm:p-6">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground text-sm">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
