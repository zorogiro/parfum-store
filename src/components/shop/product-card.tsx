import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTND } from "@/lib/money";
import type { ProductCardData } from "@/lib/product-card-data";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";

const s = t.shop.card;

/** Matches the grid: 2 columns on mobile, 3 from `sm`, 4 from `lg` (max container 72rem). */
export const PRODUCT_CARD_SIZES = "(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw";

export function ProductCard({ product }: { product: ProductCardData }) {
  const price =
    product.price === null
      ? null
      : product.hasPriceRange
        ? format(s.from, { price: formatTND(product.price) })
        : formatTND(product.price);

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group focus-visible:ring-ring/50 block rounded-lg outline-none focus-visible:ring-3"
    >
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes={PRODUCT_CARD_SIZES}
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              product.soldOut ? "opacity-60" : ""
            }`}
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <ImageIcon className="size-8" aria-label={s.noImage} />
          </div>
        )}
        {product.soldOut && (
          <Badge variant="secondary" className="absolute top-2 left-2 h-6 px-2.5">
            {s.soldOut}
          </Badge>
        )}
      </div>
      <div className="mt-2 space-y-0.5">
        {product.brand && (
          <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
            {product.brand}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">{product.name}</h3>
        {price && (
          <p className="flex flex-wrap items-baseline gap-x-2 pt-0.5 text-sm">
            <span className="font-semibold">{price}</span>
            {product.compareAtPrice !== null && (
              <del className="text-muted-foreground text-xs">
                {formatTND(product.compareAtPrice)}
              </del>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
