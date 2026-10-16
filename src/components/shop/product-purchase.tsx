"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTND } from "@/lib/money";
import {
  buildVariantModel,
  clampQuantity,
  colorToCss,
  discountPercent,
  initialSelection,
  isOptionAvailable,
  maxQuantity,
  minPrice,
  resolveVariant,
  selectOption,
  stockStatus,
  type Axis,
  type ProductType,
  type Selection,
  type VariantInput,
} from "@/lib/product-variants";
import { t } from "@/lib/strings";
import { cn, format } from "@/lib/utils";
import { useCartActions } from "./use-cart-actions";

const s = t.shop.product;

/** Display order of the selectors (differs from the logic priority: sizes before colors). */
const DISPLAY_ORDER: Axis[] = ["volumeMl", "size", "color", "label"];

const AXIS_LABEL: Record<Axis, string> = {
  volumeMl: s.volume,
  size: s.size,
  color: s.color,
  label: s.option,
};

function optionText(axis: Axis, value: string) {
  return axis === "volumeMl" ? format(s.volumeValue, { value }) : value;
}

function PriceBlock({
  price,
  compareAtPrice,
  from,
  size = "lg",
}: {
  price: number | null;
  compareAtPrice: number | null;
  from: boolean;
  size?: "lg" | "sm";
}) {
  if (price === null) return null;
  const percent = discountPercent(price, compareAtPrice);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("font-semibold", size === "lg" ? "text-2xl" : "text-base")}>
          {from ? format(s.from, { price: formatTND(price) }) : formatTND(price)}
        </span>
        {percent !== null && compareAtPrice !== null && (
          <>
            <del className="text-muted-foreground text-sm" aria-label={s.wasPrice}>
              {formatTND(compareAtPrice)}
            </del>
            <Badge
              variant="destructive"
              className="h-6 px-2.5"
              aria-label={format(s.discountLabel, { percent })}
            >
              {format(s.discount, { percent })}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  selected,
  disabled,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 relative inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-medium outline-none focus-visible:ring-3",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
        disabled &&
          "text-muted-foreground bg-muted/50 hover:bg-muted/50 cursor-not-allowed overflow-hidden line-through opacity-60",
      )}
    >
      {children}
    </button>
  );
}

function ColorSwatch({
  selected,
  disabled,
  onClick,
  name,
  label,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  name: string;
  label: string;
}) {
  const css = colorToCss(name);
  if (!css) {
    return (
      <OptionButton selected={selected} disabled={disabled} onClick={onClick} label={label}>
        {name}
      </OptionButton>
    );
  }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={name}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 relative flex size-11 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3",
        selected ? "border-primary" : "border-transparent",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span className="size-8 rounded-full border" style={{ backgroundColor: css }} />
      {disabled && (
        <span aria-hidden className="bg-muted-foreground absolute h-0.5 w-9 rotate-45 rounded" />
      )}
    </button>
  );
}

type PurchaseVariant = VariantInput;

export function ProductPurchase({
  type,
  variants,
}: {
  type: ProductType;
  variants: PurchaseVariant[];
}) {
  const model = useMemo(() => buildVariantModel(type, variants), [type, variants]);
  const [selection, setSelection] = useState<Selection>(() => initialSelection(model));
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartActions();

  const selected = resolveVariant(model, selection);
  const stock = selected?.stock ?? 0;
  const max = maxQuantity(stock);
  const status = selected ? stockStatus(stock) : { kind: "out" as const };
  const soldOut = status.kind === "out";
  const qty = clampQuantity(quantity, stock);

  // "À partir de": before any variant is chosen (only possible when all are sold out).
  const price = selected ? selected.price : minPrice(variants);
  const compareAtPrice = selected ? selected.compareAtPrice : null;
  const fromPrice = !selected && variants.length > 1;

  const mainButton = useRef<HTMLDivElement>(null);
  const [mainButtonVisible, setMainButtonVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const target = mainButton.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMainButtonVisible(entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px" }, // under the sticky header
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Don't cover the footer links with the sticky bar.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  function choose(axis: Axis, value: string) {
    setSelection((current) => selectOption(model, current, axis, value));
  }

  function add() {
    if (!selected || soldOut) return;
    addItem(selected.id, qty);
  }

  const showStickyBar = !mainButtonVisible && !footerVisible;
  const axes = DISPLAY_ORDER.filter((axis) => model.axes.includes(axis));

  return (
    <div className="space-y-5">
      <PriceBlock price={price} compareAtPrice={compareAtPrice} from={fromPrice} />

      {axes.map((axis) => {
        const chosen = selection[axis];
        return (
          <div key={axis} className="space-y-2">
            <p id={`opt-${axis}`} className="text-sm font-medium">
              {AXIS_LABEL[axis]}
              {chosen && (
                <span className="text-muted-foreground font-normal">
                  {" : "}
                  {optionText(axis, chosen)}
                </span>
              )}
            </p>
            <div role="radiogroup" aria-labelledby={`opt-${axis}`} className="flex flex-wrap gap-2">
              {model.values[axis].map((value) => {
                const available = isOptionAvailable(model, selection, axis, value);
                const text = optionText(axis, value);
                const label = available ? text : format(s.optionSoldOut, { value: text });
                return axis === "color" ? (
                  <ColorSwatch
                    key={value}
                    name={value}
                    label={label}
                    selected={chosen === value}
                    disabled={!available}
                    onClick={() => choose(axis, value)}
                  />
                ) : (
                  <OptionButton
                    key={value}
                    label={label}
                    selected={chosen === value}
                    disabled={!available}
                    onClick={() => choose(axis, value)}
                  >
                    {text}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        );
      })}

      <p
        role="status"
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          status.kind === "in" && "text-emerald-700 dark:text-emerald-400",
          status.kind === "low" && "text-amber-700 dark:text-amber-400",
          status.kind === "out" && "text-destructive",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            status.kind === "in" && "bg-emerald-600",
            status.kind === "low" && "bg-amber-500",
            status.kind === "out" && "bg-destructive",
          )}
        />
        {status.kind === "in" && s.inStock}
        {status.kind === "low" && format(s.lowStock, { count: status.count })}
        {status.kind === "out" && s.soldOut}
      </p>

      <div ref={mainButton} className="flex flex-wrap items-center gap-3">
        {!soldOut && (
          <div
            role="group"
            aria-label={s.quantity}
            className="flex h-12 items-center rounded-lg border"
          >
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              aria-label={s.decrease}
              className="focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-l-lg outline-none focus-visible:ring-3 disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <output aria-live="polite" className="min-w-8 text-center font-medium tabular-nums">
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(max, qty + 1))}
              disabled={qty >= max}
              aria-label={qty >= max ? s.maxReached : s.increase}
              className="focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-r-lg outline-none focus-visible:ring-3 disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <Button
          type="button"
          size="lg"
          className="h-12 min-w-0 flex-1 px-6 text-base"
          disabled={soldOut}
          onClick={add}
        >
          {soldOut ? s.soldOut : s.addToCart}
        </Button>
      </div>

      <div
        aria-hidden={!showStickyBar}
        inert={!showStickyBar}
        className={cn(
          "bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgb(0_0_0/0.06)] backdrop-blur transition-transform duration-200 lg:hidden",
          showStickyBar ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <PriceBlock price={price} compareAtPrice={compareAtPrice} from={fromPrice} size="sm" />
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11 shrink-0 px-5"
            disabled={soldOut}
            onClick={add}
          >
            {soldOut ? s.soldOut : s.addToCart}
          </Button>
        </div>
      </div>
    </div>
  );
}
