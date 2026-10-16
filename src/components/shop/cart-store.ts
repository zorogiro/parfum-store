import {
  CART_STORAGE_KEY,
  addToItems,
  parseStoredCart,
  removeFromItems,
  setItemQuantity,
  writeCart,
  type AddResult,
  type CartItem,
} from "@/lib/cart-storage";

/**
 * Client-side cart store for useSyncExternalStore: localStorage is the source of truth, so the
 * "storage" event keeps several tabs in sync. If localStorage is unusable (private mode, quota),
 * the cart keeps working in memory for this page view.
 */
const EMPTY: CartItem[] = [];

let items: CartItem[] = EMPTY;
let lastRaw: string | null | undefined; // undefined = never read
let memoryOnly = false;
const listeners = new Set<() => void>();

function rawStored(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getSnapshot(): CartItem[] {
  if (memoryOnly) return items;
  const raw = rawStored();
  if (raw !== lastRaw) {
    lastRaw = raw;
    items = raw === null ? EMPTY : parseStoredCart(raw);
  }
  return items;
}

export function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CART_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: CartItem[]) {
  if (next === items) return;
  if (writeCart(next)) {
    memoryOnly = false;
    lastRaw = undefined; // force a re-read so the snapshot matches what was stored
    items = next.length === 0 ? EMPTY : next;
    getSnapshot();
  } else {
    memoryOnly = true;
    items = next.length === 0 ? EMPTY : next;
  }
  emit();
}

export function addItem(variantId: string, quantity: number): AddResult["outcome"] {
  const result = addToItems(getSnapshot(), variantId, quantity);
  commit(result.items);
  return result.outcome;
}

export function setQuantity(variantId: string, quantity: number) {
  commit(setItemQuantity(getSnapshot(), variantId, quantity));
}

export function removeItem(variantId: string) {
  commit(removeFromItems(getSnapshot(), variantId));
}

export function clear() {
  commit([]);
}
