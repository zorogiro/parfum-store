import { describe, expect, it } from "vitest";
import {
  amountToFreeShipping,
  calculateShippingFee,
  calculateSubtotal,
  calculateTotal,
} from "./pricing";

describe("calculateSubtotal", () => {
  it("sums unitPrice * quantity", () => {
    expect(
      calculateSubtotal([
        { unitPrice: 45500, quantity: 2 },
        { unitPrice: 1000, quantity: 3 },
      ]),
    ).toBe(94000);
  });
  it("is 0 for no lines", () => {
    expect(calculateSubtotal([])).toBe(0);
  });
  it("handles large quantities without float drift", () => {
    expect(calculateSubtotal([{ unitPrice: 999999, quantity: 10_000 }])).toBe(9_999_990_000);
  });
  it("throws on invalid inputs", () => {
    expect(() => calculateSubtotal([{ unitPrice: -1, quantity: 1 }])).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: 10.5, quantity: 1 }])).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: 10, quantity: -2 }])).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: 10, quantity: 1.5 }])).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: NaN, quantity: 1 }])).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: Infinity, quantity: 1 }])).toThrow();
  });
});

describe("calculateShippingFee", () => {
  const base = { zoneFee: 8000, freeShippingThreshold: 200000 };
  it("is free when the threshold is exactly met", () => {
    expect(calculateShippingFee({ ...base, subtotal: 200000 })).toBe(0);
  });
  it("charges the zone fee 1 millime below the threshold", () => {
    expect(calculateShippingFee({ ...base, subtotal: 199999 })).toBe(8000);
  });
  it("is free above the threshold", () => {
    expect(calculateShippingFee({ ...base, subtotal: 500000 })).toBe(0);
  });
  it("is 0 for an empty cart", () => {
    expect(calculateShippingFee({ ...base, subtotal: 0 })).toBe(0);
    expect(calculateShippingFee({ ...base, subtotal: 0, freeShippingThreshold: null })).toBe(0);
  });
  it("always charges when the threshold is disabled (null or 0)", () => {
    const disabled = { subtotal: 9_000_000, zoneFee: 7000 };
    expect(calculateShippingFee({ ...disabled, freeShippingThreshold: null })).toBe(7000);
    expect(calculateShippingFee({ ...disabled, freeShippingThreshold: 0 })).toBe(7000);
  });
  it("supports a custom zone fee, including 0", () => {
    const input = { subtotal: 1000, freeShippingThreshold: null };
    expect(calculateShippingFee({ ...input, zoneFee: 12500 })).toBe(12500);
    expect(calculateShippingFee({ ...input, zoneFee: 0 })).toBe(0);
  });
  it("throws on invalid inputs", () => {
    expect(() => calculateShippingFee({ ...base, subtotal: -1 })).toThrow();
    expect(() => calculateShippingFee({ ...base, subtotal: 1.5 })).toThrow();
    expect(() => calculateShippingFee({ ...base, subtotal: 100, zoneFee: -5 })).toThrow();
    expect(() => calculateShippingFee({ ...base, subtotal: 100, zoneFee: 1.2 })).toThrow();
    expect(() =>
      calculateShippingFee({ ...base, subtotal: 100, freeShippingThreshold: -1 }),
    ).toThrow();
    expect(() =>
      calculateShippingFee({ ...base, subtotal: 100, freeShippingThreshold: 1.5 }),
    ).toThrow();
  });
});

describe("calculateTotal", () => {
  it("adds shipping to the subtotal", () => {
    expect(
      calculateTotal({ subtotal: 100000, zoneFee: 8000, freeShippingThreshold: 200000 }),
    ).toEqual({ subtotal: 100000, shippingFee: 8000, total: 108000 });
  });
  it("has no shipping once free", () => {
    expect(
      calculateTotal({ subtotal: 200000, zoneFee: 8000, freeShippingThreshold: 200000 }).total,
    ).toBe(200000);
  });
  it("is 0 for an empty cart", () => {
    expect(calculateTotal({ subtotal: 0, zoneFee: 8000, freeShippingThreshold: 200000 })).toEqual({
      subtotal: 0,
      shippingFee: 0,
      total: 0,
    });
  });
});

describe("amountToFreeShipping", () => {
  it("returns the missing amount", () => {
    expect(amountToFreeShipping(150000, 200000)).toBe(50000);
    expect(amountToFreeShipping(199999, 200000)).toBe(1);
  });
  it("returns 0 once reached", () => {
    expect(amountToFreeShipping(200000, 200000)).toBe(0);
    expect(amountToFreeShipping(300000, 200000)).toBe(0);
  });
  it("returns null when disabled", () => {
    expect(amountToFreeShipping(1000, null)).toBeNull();
    expect(amountToFreeShipping(1000, 0)).toBeNull();
  });
  it("throws on invalid inputs", () => {
    expect(() => amountToFreeShipping(-1, 1000)).toThrow();
    expect(() => amountToFreeShipping(1.5, 1000)).toThrow();
    expect(() => amountToFreeShipping(10, -1000)).toThrow();
  });
});
