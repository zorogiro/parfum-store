import { describe, expect, it } from "vitest";
import {
  effectiveQuantity,
  lineStatus,
  parseThresholdSetting,
  type CartLineDetail,
} from "./cart-details";

describe("lineStatus", () => {
  it("is OK when stock covers the request", () => {
    expect(lineStatus(2, 5)).toEqual({ status: "OK", availableQuantity: 5 });
    expect(lineStatus(5, 5)).toEqual({ status: "OK", availableQuantity: 5 });
  });
  it("is REDUCED when the request exceeds stock", () => {
    expect(lineStatus(4, 3)).toEqual({ status: "REDUCED", availableQuantity: 3 });
  });
  it("is OUT_OF_STOCK without stock (also negative)", () => {
    expect(lineStatus(1, 0)).toEqual({ status: "OUT_OF_STOCK", availableQuantity: 0 });
    expect(lineStatus(1, -2)).toEqual({ status: "OUT_OF_STOCK", availableQuantity: 0 });
  });
  it("never exposes stock above 10", () => {
    expect(lineStatus(1, 500).availableQuantity).toBe(10);
    expect(lineStatus(10, 500).status).toBe("OK");
  });
});

describe("effectiveQuantity", () => {
  const ok = (status: "OK" | "REDUCED" | "OUT_OF_STOCK", availableQuantity: number) =>
    ({
      variantId: "v",
      status,
      productName: "P",
      productSlug: "p",
      variantLabel: "L",
      imageUrl: null,
      unitPrice: 1000,
      compareAtPrice: null,
      availableQuantity,
    }) satisfies CartLineDetail;
  it("lowers to the available quantity", () => {
    expect(effectiveQuantity(ok("REDUCED", 2), 5)).toBe(2);
    expect(effectiveQuantity(ok("OK", 10), 3)).toBe(3);
  });
  it("is 0 for unavailable and sold-out lines", () => {
    expect(effectiveQuantity(ok("OUT_OF_STOCK", 0), 3)).toBe(0);
    expect(effectiveQuantity({ variantId: "v", status: "UNAVAILABLE" }, 3)).toBe(0);
  });
});

describe("parseThresholdSetting", () => {
  it("parses a positive integer", () => {
    expect(parseThresholdSetting("200000")).toBe(200000);
    expect(parseThresholdSetting(" 150000 ")).toBe(150000);
  });
  it("is null when missing, zero or invalid", () => {
    expect(parseThresholdSetting(null)).toBeNull();
    expect(parseThresholdSetting("")).toBeNull();
    expect(parseThresholdSetting("0")).toBeNull();
    expect(parseThresholdSetting("abc")).toBeNull();
    expect(parseThresholdSetting("-5")).toBeNull();
    expect(parseThresholdSetting("10.5")).toBeNull();
  });
});
