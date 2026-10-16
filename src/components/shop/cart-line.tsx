"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CartLineDetail } from "@/lib/cart-details";
import { effectiveQuantity } from "@/lib/cart-details";
import { formatTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { cn, format } from "@/lib/utils";

const s = t.shop.cart;

/** One cart row. `detail` undefined = still loading (a new variant was just added). */
export function CartLine({
  detail,
  quantity,
  adjustedTo,
  onQuantity,
  onRemove,
  onNavigate,
}: {
  detail: CartLineDetail | undefined;
  /** Quantity stored in the cart. */
  quantity: number;
  /** Set when the quantity was just lowered to the stock available. */
  adjustedTo: number | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onNavigate?: () => void;
}) {
  if (!detail) {
    return (
      <li aria-busy="true" className="flex gap-3 py-4">
        <div className="bg-muted size-20 shrink-0 animate-pulse rounded-lg" />
        <div className="flex-1 space-y-2 py-1">
          <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
        </div>
      </li>
    );
  }

  if (detail.status === "UNAVAILABLE") {
    return (
      <li
        data-testid="cart-line"
        data-status="UNAVAILABLE"
        className="flex items-center gap-3 py-4"
      >
        <div className="bg-muted size-20 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1 opacity-60">
          <p className="font-medium">{s.unavailableName}</p>
          <Badge variant="secondary">{s.unavailable}</Badge>
        </div>
        <RemoveButton name={s.unavailableName} onRemove={onRemove} />
      </li>
    );
  }

  const soldOut = detail.status === "OUT_OF_STOCK";
  const shown = soldOut ? quantity : effectiveQuantity(detail, quantity);
  const href = `/p/${detail.productSlug}`;

  return (
    <li data-testid="cart-line" data-status={detail.status} className="flex gap-3 py-4">
      <Link
        href={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "bg-muted relative size-20 shrink-0 overflow-hidden rounded-lg",
          soldOut && "opacity-50 grayscale",
        )}
      >
        {detail.imageUrl && (
          <Image src={detail.imageUrl} alt="" fill sizes="80px" className="object-cover" />
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("min-w-0", soldOut && "opacity-60")}>
            <Link
              href={href}
              onClick={onNavigate}
              className="line-clamp-2 font-medium hover:underline"
            >
              {detail.productName}
            </Link>
            <p className="text-muted-foreground text-sm">{detail.variantLabel}</p>
          </div>
          <RemoveButton name={detail.productName} onRemove={onRemove} />
        </div>

        {soldOut ? (
          <Badge variant="secondary">{s.soldOut}</Badge>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <div className="space-y-0.5">
                <p className="text-sm">
                  {formatTND(detail.unitPrice)}
                  {detail.compareAtPrice !== null && detail.compareAtPrice > detail.unitPrice && (
                    <span className="text-muted-foreground ml-1.5 text-xs line-through">
                      {formatTND(detail.compareAtPrice)}
                    </span>
                  )}
                </p>
                <Stepper
                  name={detail.productName}
                  value={shown}
                  max={detail.availableQuantity}
                  onChange={onQuantity}
                />
              </div>
              <p className="font-semibold" aria-label={s.lineTotal} data-testid="line-total">
                {formatTND(detail.unitPrice * shown)}
              </p>
            </div>
            {adjustedTo !== undefined && (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
                {format(s.adjusted, { count: adjustedTo })}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function Stepper({
  name,
  value,
  max,
  onChange,
}: {
  name: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={format(s.quantityOf, { name })}
      className="inline-flex items-center rounded-lg border"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={s.decrease}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <span
        className="min-w-8 text-center text-sm font-medium tabular-nums"
        data-testid="line-quantity"
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={s.increase}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      className="text-muted-foreground -mt-1 -mr-2 shrink-0"
      aria-label={format(s.remove, { name })}
      onClick={onRemove}
    >
      <Trash2 aria-hidden />
    </Button>
  );
}
