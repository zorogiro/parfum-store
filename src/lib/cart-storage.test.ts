import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CART_STORAGE_KEY,
  addToItems,
  removeFromItems,
  setItemQuantity,
  normalizeCartItems,
  parseStoredCart,
  readCart,
  writeCart,
} from "./cart-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("parseStoredCart", () => {
  it("returns an empty cart for missing data", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("")).toEqual([]);
  });
  it("returns an empty cart for corrupted JSON", () => {
    expect(parseStoredCart("{not json")).toEqual([]);
    expect(parseStoredCart("[{")).toEqual([]);
  });
  it("returns an empty cart for the wrong shape", () => {
    expect(parseStoredCart('{"variantId":"a","quantity":1}')).toEqual([]);
    expect(parseStoredCart('"hello"')).toEqual([]);
    expect(parseStoredCart("42")).toEqual([]);
    expect(parseStoredCart("null")).toEqual([]);
  });
  it("keeps valid entries", () => {
    expect(parseStoredCart('[{"variantId":"abc","quantity":2}]')).toEqual([
      { variantId: "abc", quantity: 2 },
    ]);
  });
});

describe("normalizeCartItems", () => {
  it("drops invalid entries but keeps the valid ones", () => {
    expect(
      normalizeCartItems([
        null,
        "x",
        42,
        {},
        { variantId: "ok", quantity: 1 },
        { variantId: 5, quantity: 1 },
        { variantId: "", quantity: 1 },
        { variantId: "bad id!", quantity: 1 },
        { variantId: "x".repeat(65), quantity: 1 },
        { variantId: "zero", quantity: 0 },
        { variantId: "neg", quantity: -3 },
        { variantId: "frac", quantity: 1.5 },
        { variantId: "str", quantity: "2" },
        { variantId: "nan", quantity: NaN },
      ]),
    ).toEqual([{ variantId: "ok", quantity: 1 }]);
  });
  it("merges duplicate variantIds", () => {
    expect(
      normalizeCartItems([
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 1 },
        { variantId: "a", quantity: 3 },
      ]),
    ).toEqual([
      { variantId: "a", quantity: 5 },
      { variantId: "b", quantity: 1 },
    ]);
  });
  it("clamps quantities to 10, also when merging", () => {
    expect(normalizeCartItems([{ variantId: "a", quantity: 99 }])).toEqual([
      { variantId: "a", quantity: 10 },
    ]);
    expect(
      normalizeCartItems([
        { variantId: "a", quantity: 7 },
        { variantId: "a", quantity: 7 },
      ]),
    ).toEqual([{ variantId: "a", quantity: 10 }]);
  });
  it("keeps at most 20 distinct lines, but still merges into existing ones", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ variantId: `v${i}`, quantity: 1 }));
    const result = normalizeCartItems([...many, { variantId: "v0", quantity: 2 }]);
    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ variantId: "v0", quantity: 3 });
    expect(result.at(-1)?.variantId).toBe("v19");
  });
});

describe("readCart / writeCart", () => {
  it("round-trips through localStorage under the versioned key", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    expect(CART_STORAGE_KEY).toMatch(/\.v1$/);
    expect(writeCart([{ variantId: "a", quantity: 2 }])).toBe(true);
    expect(JSON.parse(storage.data.get(CART_STORAGE_KEY)!)).toEqual([
      { variantId: "a", quantity: 2 },
    ]);
    expect(readCart()).toEqual([{ variantId: "a", quantity: 2 }]);
  });
  it("removes the key when the cart is empty", () => {
    const storage = fakeStorage({ [CART_STORAGE_KEY]: "[]" });
    vi.stubGlobal("localStorage", storage);
    writeCart([]);
    expect(storage.data.has(CART_STORAGE_KEY)).toBe(false);
  });
  it("reads an empty cart from corrupted storage", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [CART_STORAGE_KEY]: "}}}" }));
    expect(readCart()).toEqual([]);
  });
  it("does not crash when localStorage is missing", () => {
    expect(readCart()).toEqual([]);
    expect(writeCart([{ variantId: "a", quantity: 1 }])).toBe(false);
  });
  it("does not crash when accessing localStorage throws", () => {
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(readCart()).toEqual([]);
      expect(writeCart([{ variantId: "a", quantity: 1 }])).toBe(false);
    } finally {
      // vi.unstubAllGlobals restores the original (absent) descriptor
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });
  it("does not crash when setItem throws (quota exceeded)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(writeCart([{ variantId: "a", quantity: 1 }])).toBe(false);
  });
});

describe("cart operations", () => {
  it("adds new lines and merges existing ones", () => {
    const a = addToItems([], "a", 2);
    expect(a).toEqual({ items: [{ variantId: "a", quantity: 2 }], outcome: "added" });
    expect(addToItems(a.items, "a", 3).items).toEqual([{ variantId: "a", quantity: 5 }]);
  });
  it("caps a line at 10 and reports it", () => {
    const r = addToItems([{ variantId: "a", quantity: 8 }], "a", 5);
    expect(r).toEqual({ items: [{ variantId: "a", quantity: 10 }], outcome: "capped" });
  });
  it("refuses a 21st distinct line but still increments existing ones", () => {
    const full = Array.from({ length: 20 }, (_, i) => ({ variantId: `v${i}`, quantity: 1 }));
    expect(addToItems(full, "new", 1)).toEqual({ items: full, outcome: "full" });
    expect(addToItems(full, "v3", 1).items[3].quantity).toBe(2);
  });
  it("ignores invalid input", () => {
    expect(addToItems([], "bad id!", 1).items).toEqual([]);
    expect(addToItems([], "a", 0).items).toEqual([]);
    expect(addToItems([], "a", 1.5).items).toEqual([]);
  });
  it("sets, clamps and removes quantities", () => {
    const items = [{ variantId: "a", quantity: 2 }];
    expect(setItemQuantity(items, "a", 4)).toEqual([{ variantId: "a", quantity: 4 }]);
    expect(setItemQuantity(items, "a", 50)).toEqual([{ variantId: "a", quantity: 10 }]);
    expect(setItemQuantity(items, "a", 0)).toEqual([]);
    expect(setItemQuantity(items, "zzz", 3)).toEqual(items);
    expect(removeFromItems(items, "a")).toEqual([]);
  });
});
