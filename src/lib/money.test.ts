import { describe, expect, it } from "vitest";
import { formatTND } from "./money";

const NNBSP = " ";

describe("formatTND", () => {
  it("formats millimes with 3 decimals", () => {
    expect(formatTND(45500)).toBe("45,500 TND");
    expect(formatTND(8000)).toBe("8,000 TND");
    expect(formatTND(0)).toBe("0,000 TND");
    expect(formatTND(5)).toBe("0,005 TND");
  });

  it("groups thousands with a narrow no-break space (French)", () => {
    expect(formatTND(1234567)).toBe(`1${NNBSP}234,567 TND`);
  });

  it("handles negatives", () => {
    expect(formatTND(-1500)).toBe("-1,500 TND");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatTND(10.5)).toThrow();
  });
});
