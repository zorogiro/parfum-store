import { describe, expect, it } from "vitest";
import { formatOrderNumber } from "./order-number";

describe("formatOrderNumber", () => {
  it("pads to 6 digits", () => {
    expect(formatOrderNumber(1)).toBe("ORD-000001");
    expect(formatOrderNumber(BigInt(123))).toBe("ORD-000123");
  });

  it("grows past 6 digits without truncating", () => {
    expect(formatOrderNumber(1234567)).toBe("ORD-1234567");
  });
});
