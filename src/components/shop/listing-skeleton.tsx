import { ProductGridSkeleton } from "./product-grid";

/** Fallback for category and search pages while the listing loads. */
export function ListingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="bg-muted h-4 w-48 animate-pulse rounded" />
      <div className="bg-muted h-8 w-64 animate-pulse rounded" />
      <div className="flex items-center justify-between">
        <div className="bg-muted h-10 w-28 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-40 animate-pulse rounded-lg" />
      </div>
      <ProductGridSkeleton count={12} />
    </div>
  );
}
