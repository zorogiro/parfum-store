"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { effectiveQuantity, type CartDetails, type CartLineDetail } from "@/lib/cart-details";
import { formatTND } from "@/lib/money";
import { amountToFreeShipping, calculateSubtotal } from "@/lib/pricing";
import { t } from "@/lib/strings";
import { cn, format } from "@/lib/utils";
import { getCartDetails } from "@/server/cart";
import { CartLine } from "./cart-line";
import { useCart } from "./cart-provider";

const s = t.shop.cart;

type Fetched = { data: CartDetails | null; failed: boolean; attempt: number };

/**
 * Cart contents, shared by the drawer and the /cart page. The cart only stores
 * {variantId, quantity}; everything displayed (names, prices, stock) comes from getCartDetails.
 */
export function CartView({
  layout,
  onNavigate,
}: {
  layout: "drawer" | "page";
  onNavigate?: () => void;
}) {
  const { items, isHydrated, setQuantity, removeItem } = useCart();
  const [fetched, setFetched] = useState<Fetched>({ data: null, failed: false, attempt: 0 });
  const [attempt, setAttempt] = useState(0);
  /** variantId -> available quantity the line was lowered to (message shown until it is edited). */
  const [adjusted, setAdjusted] = useState<Record<string, number>>({});

  // Latest cart for the fetch effect below (which must not re-run on quantity edits).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Refetch when the set of variants changes (not on quantity edits: prices don't depend on them
  // and the stepper is capped by availableQuantity). Old data stays visible meanwhile.
  const idsKey = useMemo(
    () =>
      items
        .map((i) => i.variantId)
        .sort()
        .join(","),
    [items],
  );

  useEffect(() => {
    if (!isHydrated || idsKey === "") return;
    let cancelled = false;
    getCartDetails(itemsRef.current).then(
      (result) => {
        if (cancelled) return;
        setFetched((prev) =>
          result.ok
            ? { data: result, failed: false, attempt }
            : { data: prev.data, failed: true, attempt },
        );
      },
      () => {
        if (!cancelled) setFetched((prev) => ({ data: prev.data, failed: true, attempt }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isHydrated, idsKey, attempt]);

  const detailsById = useMemo(
    () => new Map(fetched.data?.lines.map((l) => [l.variantId, l]) ?? []),
    [fetched.data],
  );

  if (!isHydrated) return <CartSkeleton layout={layout} />;
  if (items.length === 0) return <CartEmpty layout={layout} onNavigate={onNavigate} />;

  const missing = items.some((i) => !detailsById.has(i.variantId));
  if (fetched.failed && (missing || !fetched.data)) {
    return (
      <CartError
        layout={layout}
        onRetry={() => {
          setFetched((prev) => ({ ...prev, failed: false }));
          setAttempt((a) => a + 1);
        }}
      />
    );
  }
  if (!fetched.data) return <CartSkeleton layout={layout} />;

  const rows = items.map((item) => ({ item, detail: detailsById.get(item.variantId) }));
  const valid = rows.flatMap(({ item, detail }) => {
    if (!detail || detail.status === "UNAVAILABLE" || detail.status === "OUT_OF_STOCK") return [];
    return [{ detail, quantity: effectiveQuantity(detail, item.quantity) }];
  });
  const subtotal = calculateSubtotal(
    valid.map(({ detail, quantity }) => ({
      unitPrice: detail.unitPrice,
      quantity,
    })),
  );
  const validCount = valid.reduce((n, l) => n + l.quantity, 0);

  return (
    <div
      className={cn(
        layout === "drawer"
          ? "flex min-h-0 flex-1 flex-col"
          : "grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start",
      )}
    >
      <ul
        className={cn(
          "divide-y",
          layout === "drawer" ? "min-h-0 flex-1 overflow-y-auto px-4" : "rounded-xl border px-4",
        )}
      >
        {rows.map(({ item, detail }) => (
          <CartLine
            key={item.variantId}
            detail={detail}
            quantity={item.quantity}
            adjustedTo={adjusted[item.variantId]}
            onNavigate={onNavigate}
            onQuantity={(q) => {
              setAdjusted((prev) => {
                const next = { ...prev };
                delete next[item.variantId];
                return next;
              });
              setQuantity(item.variantId, q);
            }}
            onRemove={() => removeItem(item.variantId)}
          />
        ))}
      </ul>
      <AutoAdjust
        rows={rows}
        onAdjust={(variantId, available) => {
          setQuantity(variantId, available);
          setAdjusted((prev) => ({ ...prev, [variantId]: available }));
        }}
      />
      <CartSummary
        layout={layout}
        subtotal={subtotal}
        validCount={validCount}
        threshold={fetched.data.freeShippingThreshold}
        onNavigate={onNavigate}
      />
    </div>
  );
}

/** Lowers REDUCED lines to what is available (renders nothing). */
function AutoAdjust({
  rows,
  onAdjust,
}: {
  rows: { item: { variantId: string; quantity: number }; detail: CartLineDetail | undefined }[];
  onAdjust: (variantId: string, available: number) => void;
}) {
  useEffect(() => {
    for (const { item, detail } of rows) {
      if (detail && detail.status === "REDUCED" && item.quantity > detail.availableQuantity) {
        onAdjust(item.variantId, detail.availableQuantity);
      }
    }
  }, [rows, onAdjust]);
  return null;
}

function CartSummary({
  layout,
  subtotal,
  validCount,
  threshold,
  onNavigate,
}: {
  layout: "drawer" | "page";
  subtotal: number;
  validCount: number;
  threshold: number | null;
  onNavigate?: () => void;
}) {
  const remaining = validCount > 0 ? amountToFreeShipping(subtotal, threshold) : null;
  const progress =
    threshold && remaining !== null ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 0;
  const canCheckout = validCount > 0;

  return (
    <section
      aria-label={s.subtotal}
      className={cn(
        "space-y-3",
        layout === "drawer"
          ? "bg-background border-t px-4 py-4"
          : "rounded-xl border p-4 lg:sticky lg:top-20",
      )}
    >
      {remaining !== null && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium" data-testid="free-shipping-message">
            {remaining === 0
              ? s.freeShippingReached
              : format(s.freeShippingRemaining, { amount: formatTND(remaining) })}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={s.freeShippingProgress}
            className="bg-muted h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{s.subtotal}</span>
        <span className="text-lg font-semibold" data-testid="cart-subtotal">
          {formatTND(subtotal)}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">{s.shippingNote}</p>
      {canCheckout ? (
        <Link
          href="/checkout"
          prefetch={false}
          onClick={onNavigate}
          className={buttonVariants({ size: "lg", className: "h-11 w-full text-base" })}
        >
          {s.checkout}
        </Link>
      ) : (
        <Button size="lg" disabled className="h-11 w-full text-base">
          {s.checkout}
        </Button>
      )}
      <p className="text-muted-foreground text-center text-xs">{s.payOnDelivery}</p>
    </section>
  );
}

function CartEmpty({ layout, onNavigate }: { layout: "drawer" | "page"; onNavigate?: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        layout === "drawer" ? "flex-1" : "rounded-xl border border-dashed py-16",
      )}
    >
      <ShoppingBag className="text-muted-foreground size-10" aria-hidden />
      <h2 className="text-lg font-semibold">{s.empty.title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{s.empty.text}</p>
      <Link
        href="/"
        onClick={onNavigate}
        className={buttonVariants({ size: "lg", className: "mt-2 h-10 px-4" })}
      >
        {s.empty.action}
      </Link>
    </div>
  );
}

function CartError({ layout, onRetry }: { layout: "drawer" | "page"; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        layout === "drawer" ? "flex-1" : "rounded-xl border border-dashed py-16",
      )}
    >
      <TriangleAlert className="text-destructive size-10" aria-hidden />
      <h2 className="text-lg font-semibold">{s.error.title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{s.error.text}</p>
      <Button size="lg" className="mt-2 h-10 px-4" onClick={onRetry}>
        {s.error.retry}
      </Button>
    </div>
  );
}

function CartSkeleton({ layout }: { layout: "drawer" | "page" }) {
  return (
    <div
      aria-busy="true"
      aria-label={s.loading}
      className={cn("space-y-4", layout === "drawer" ? "flex-1 px-4 py-4" : "")}
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="bg-muted size-20 shrink-0 animate-pulse rounded-lg" />
          <div className="flex-1 space-y-2 py-1">
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
            <div className="bg-muted h-8 w-28 animate-pulse rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
