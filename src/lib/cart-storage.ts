import {
  CART_MAX_LINES,
  CART_MAX_QUANTITY,
  variantIdSchema,
  type CartItem,
} from "@/lib/validators/cart";

/**
 * Guest cart persistence in localStorage. Only `{variantId, quantity}` is stored: prices, names
 * and stock always come from the server (getCartDetails). Every access is wrapped in try/catch
 * (private mode, blocked storage, quota) and the stored data is never trusted.
 *
 * The key is versioned: if the stored shape changes, bump the suffix.
 */
export const CART_STORAGE_KEY = "parfum-store.cart.v1";

export type { CartItem };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Turns anything into a clean cart: drops invalid entries, merges duplicate variantIds
 * (quantities add up), clamps each quantity to 10 and keeps at most 20 distinct lines
 * (first come, first kept).
 */
export function normalizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, number>();
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const { variantId, quantity } = entry as Record<string, unknown>;
    const id = variantIdSchema.safeParse(variantId);
    if (!id.success) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    const existing = merged.get(id.data);
    if (existing === undefined && merged.size >= CART_MAX_LINES) continue;
    merged.set(id.data, Math.min(CART_MAX_QUANTITY, (existing ?? 0) + quantity));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Parses the stored JSON string. Corrupted or missing data gives an empty cart. */
export function parseStoredCart(json: string | null): CartItem[] {
  if (!json) return [];
  try {
    return normalizeCartItems(JSON.parse(json));
  } catch {
    return [];
  }
}

export function readCart(): CartItem[] {
  try {
    return parseStoredCart(getStorage()?.getItem(CART_STORAGE_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Returns false when the cart could not be persisted (the in-memory cart still works). */
export function writeCart(items: CartItem[]): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    if (items.length === 0) storage.removeItem(CART_STORAGE_KEY);
    else storage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizeCartItems(items)));
    return true;
  } catch {
    return false;
  }
}

export type AddResult = { items: CartItem[]; outcome: "added" | "capped" | "full" };

/**
 * Adds `quantity` of a variant. "capped": the line hit the 10-per-line maximum.
 * "full": a new line was refused because the cart already has 20 distinct lines.
 */
export function addToItems(items: CartItem[], variantId: string, quantity: number): AddResult {
  const id = variantIdSchema.safeParse(variantId);
  if (!id.success || !Number.isInteger(quantity) || quantity < 1) {
    return { items, outcome: "added" };
  }
  const existing = items.find((i) => i.variantId === id.data);
  if (!existing && items.length >= CART_MAX_LINES) return { items, outcome: "full" };
  const wanted = (existing?.quantity ?? 0) + quantity;
  const next = Math.min(CART_MAX_QUANTITY, wanted);
  const outcome = wanted > CART_MAX_QUANTITY ? "capped" : "added";
  if (existing) {
    return {
      items: items.map((i) => (i.variantId === id.data ? { ...i, quantity: next } : i)),
      outcome,
    };
  }
  return { items: [...items, { variantId: id.data, quantity: next }], outcome };
}

/** Sets a line quantity (clamped to 1..10). A quantity < 1 removes the line. Unknown ids are ignored. */
export function setItemQuantity(
  items: CartItem[],
  variantId: string,
  quantity: number,
): CartItem[] {
  if (!Number.isFinite(quantity)) return items;
  const q = Math.floor(quantity);
  if (q < 1) return removeFromItems(items, variantId);
  return items.map((i) =>
    i.variantId === variantId ? { ...i, quantity: Math.min(CART_MAX_QUANTITY, q) } : i,
  );
}

export function removeFromItems(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}
