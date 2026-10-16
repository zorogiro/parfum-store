import type { ProductCardData } from "@/lib/product-card-data";
import { t } from "@/lib/strings";
import { ProductCard } from "./product-card";

export const GRID_CLASSES =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className={GRID_CLASSES}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label={t.shop.skeleton.loading}>
      <ul className={GRID_CLASSES} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="animate-pulse">
            <div className="bg-muted aspect-square rounded-lg" />
            <div className="bg-muted mt-3 h-3 w-1/3 rounded" />
            <div className="bg-muted mt-2 h-4 w-4/5 rounded" />
            <div className="bg-muted mt-2 h-4 w-1/2 rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}
