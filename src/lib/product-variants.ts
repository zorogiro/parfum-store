/**
 * Pure helpers for the product page: variant options, selection logic, stock and discount labels.
 * No React or DB imports so everything is unit-testable.
 */

export type ProductType = "PERFUME" | "CLOTHING" | "ACCESSORY";

export type VariantInput = {
  id: string;
  sku: string;
  label: string;
  /** Millimes. */
  price: number;
  /** Millimes. */
  compareAtPrice: number | null;
  stock: number;
  options: unknown;
};

/** Selection state: axis name -> chosen value (always a string, e.g. volumeMl "50"). */
export type Selection = Record<string, string>;

export type Axis = "volumeMl" | "color" | "size" | "label";

/**
 * Axes per product type, in priority order. A lower-priority axis is constrained by the
 * choices made on higher-priority ones (sizes depend on the chosen color), never the reverse.
 */
const TYPE_AXES: Record<ProductType, Axis[]> = {
  PERFUME: ["volumeMl"],
  CLOTHING: ["color", "size"],
  ACCESSORY: ["color"],
};

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export const MAX_QUANTITY = 10;
export const LOW_STOCK_THRESHOLD = 3;

type Parsed = VariantInput & { attrs: Selection };

function readOptions(options: unknown): Record<string, unknown> {
  return options !== null && typeof options === "object" && !Array.isArray(options)
    ? (options as Record<string, unknown>)
    : {};
}

function attrsOf(variant: VariantInput): Selection {
  const o = readOptions(variant.options);
  const attrs: Selection = { label: variant.label };
  if (typeof o.volumeMl === "number" && Number.isFinite(o.volumeMl)) {
    attrs.volumeMl = String(o.volumeMl);
  }
  if (typeof o.size === "string" && o.size.trim()) attrs.size = o.size.trim();
  if (typeof o.color === "string" && o.color.trim()) attrs.color = o.color.trim();
  return attrs;
}

function sizeRank(size: string) {
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

function compareValues(axis: Axis, a: string, b: string): number {
  if (axis === "volumeMl") return Number(a) - Number(b);
  if (axis === "size") return sizeRank(a) - sizeRank(b) || a.localeCompare(b, "fr");
  return a.localeCompare(b, "fr");
}

export type VariantModel = {
  /** Variants in canonical order (volume asc, color alpha, size S..XL). */
  variants: Parsed[];
  /** Axes that actually distinguish variants (>= 2 distinct values), in priority order. */
  axes: Axis[];
  /** Distinct values per active axis, sorted for display. */
  values: Record<string, string[]>;
};

/**
 * Builds the selection model. Axes that don't distinguish variants (e.g. every variant has the
 * same color) are dropped. If the type's axes distinguish nothing but there are several variants,
 * falls back to choosing by variant label.
 */
export function buildVariantModel(type: ProductType, variants: VariantInput[]): VariantModel {
  const parsed: Parsed[] = variants.map((v) => ({ ...v, attrs: attrsOf(v) }));

  const distinct = (axis: Axis) => new Set(parsed.map((v) => v.attrs[axis] ?? ""));
  let axes = TYPE_AXES[type].filter((axis) => distinct(axis).size >= 2);
  if (axes.length === 0 && parsed.length > 1) axes = ["label"];

  const sorted = [...parsed].sort((a, b) => {
    for (const axis of axes) {
      const diff = compareValues(axis, a.attrs[axis] ?? "", b.attrs[axis] ?? "");
      if (diff !== 0) return diff;
    }
    return a.price - b.price || a.id.localeCompare(b.id);
  });

  const values: Record<string, string[]> = {};
  for (const axis of axes) {
    values[axis] = [...distinct(axis)]
      .filter((v) => v !== "")
      .sort((a, b) => compareValues(axis, a, b));
  }
  return { variants: sorted, axes, values };
}

function matches(variant: Parsed, selection: Selection, axes: Axis[]): boolean {
  return axes.every(
    (axis) => selection[axis] === undefined || variant.attrs[axis] === selection[axis],
  );
}

function selectionOf(variant: Parsed, axes: Axis[]): Selection {
  const selection: Selection = {};
  for (const axis of axes) {
    const value = variant.attrs[axis];
    if (value !== undefined) selection[axis] = value;
  }
  return selection;
}

/** Selection of the first in-stock variant. Empty when everything is sold out (multi-variant). */
export function initialSelection(model: VariantModel): Selection {
  const first = model.variants.find((v) => v.stock > 0);
  if (first) return selectionOf(first, model.axes);
  if (model.variants.length === 1) return selectionOf(model.variants[0], model.axes);
  return {};
}

/** The variant matching a complete selection, or null (incomplete selection or no such combination). */
export function resolveVariant(model: VariantModel, selection: Selection): Parsed | null {
  if (model.variants.length === 1) return model.variants[0];
  if (model.axes.some((axis) => selection[axis] === undefined)) return null;
  return model.variants.find((v) => matches(v, selection, model.axes)) ?? null;
}

/**
 * Whether choosing `value` on `axis` leads to an in-stock variant, given the choices already made
 * on higher-priority axes. Used to disable buttons: with color picked, sizes with no stock in that
 * color are disabled. The first axis is only disabled when it is sold out entirely.
 */
export function isOptionAvailable(
  model: VariantModel,
  selection: Selection,
  axis: Axis,
  value: string,
): boolean {
  const higher = model.axes.slice(0, model.axes.indexOf(axis));
  return model.variants.some(
    (v) => v.stock > 0 && v.attrs[axis] === value && matches(v, selection, higher),
  );
}

/**
 * Applies a click on `axis` = `value`. Keeps the other choices when that combination is in stock;
 * otherwise moves to the best matching variant (in stock first, then closest to the current choices).
 */
export function selectOption(
  model: VariantModel,
  selection: Selection,
  axis: Axis,
  value: string,
): Selection {
  const next = { ...selection, [axis]: value };
  const exact = model.variants.find((v) => matches(v, next, model.axes));
  const complete = model.axes.every((a) => next[a] !== undefined);
  if (exact && exact.stock > 0 && complete) return next;

  const candidates = model.variants.filter((v) => v.attrs[axis] === value);
  if (candidates.length === 0) return selection;

  const closeness = (v: Parsed) =>
    model.axes.filter(
      (a) => a !== axis && selection[a] !== undefined && v.attrs[a] === selection[a],
    ).length;
  const best = [...candidates].sort(
    (a, b) => Number(b.stock > 0) - Number(a.stock > 0) || closeness(b) - closeness(a),
  )[0];
  return selectionOf(best, model.axes);
}

/** Smallest price (millimes) among variants, or null without variants. */
export function minPrice(variants: { price: number }[]): number | null {
  return variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : null;
}

/** "-X%" value for a struck-through price, or null when there is no real discount. */
export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (compareAtPrice === null || price <= 0 || compareAtPrice <= price) return null;
  const percent = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
  return percent >= 1 ? percent : null;
}

export type StockStatus = { kind: "out" } | { kind: "low"; count: number } | { kind: "in" };

/** Exact stock is only ever exposed up to LOW_STOCK_THRESHOLD. */
export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return { kind: "out" };
  if (stock <= LOW_STOCK_THRESHOLD) return { kind: "low", count: stock };
  return { kind: "in" };
}

/** Max orderable quantity for a variant: min(stock, 10), never negative. */
export function maxQuantity(stock: number): number {
  return Math.max(0, Math.min(stock, MAX_QUANTITY));
}

export function clampQuantity(quantity: number, stock: number): number {
  const max = maxQuantity(stock);
  if (max === 0) return 1;
  return Math.min(Math.max(1, Math.floor(quantity) || 1), max);
}

const COLOR_CSS: Record<string, string> = {
  noir: "#111111",
  blanc: "#ffffff",
  gris: "#9ca3af",
  argent: "#c0c0c0",
  argente: "#c0c0c0",
  or: "#d4af37",
  dore: "#d4af37",
  rouge: "#dc2626",
  bordeaux: "#6d1a2c",
  rose: "#f9a8d4",
  orange: "#f97316",
  jaune: "#facc15",
  vert: "#16a34a",
  kaki: "#78783c",
  bleu: "#2563eb",
  marine: "#1e2a5a",
  turquoise: "#14b8a6",
  violet: "#7c3aed",
  beige: "#e0cfae",
  creme: "#f5efe0",
  marron: "#7c4a2d",
  camel: "#c19a6b",
};

/** CSS color for a French color name, or null when unknown (the UI then shows a text chip). */
export function colorToCss(name: string): string | null {
  const key = name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return COLOR_CSS[key] ?? null;
}
