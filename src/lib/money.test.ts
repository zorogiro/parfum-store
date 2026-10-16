import { describe, expect, it } from "vitest";
import { formatTND, parseTND, toTNDInputValue } from "./money";

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

describe("parseTND", () => {
  it("converts TND amounts to millimes", () => {
    expect(parseTND("45.5")).toBe(45500);
    expect(parseTND("45.500")).toBe(45500);
    expect(parseTND("45,500")).toBe(45500);
    expect(parseTND("45,5")).toBe(45500);
    expect(parseTND("45")).toBe(45000);
    expect(parseTND("0.005")).toBe(5);
    expect(parseTND(".5")).toBe(500);
    expect(parseTND(45.5)).toBe(45500);
  });

  it("tolerates whitespace and a currency suffix", () => {
    expect(parseTND("  45,500 TND ")).toBe(45500);
    expect(parseTND("1\u202F234,5")).toBe(1234500);
  });

  it("rounds half-up beyond 3 decimals", () => {
    expect(parseTND("0.0004")).toBe(0);
    expect(parseTND("0.0005")).toBe(1);
    expect(parseTND("45.5555")).toBe(45556);
    expect(parseTND("45.9995")).toBe(46000);
  });

  it("is not affected by float representation errors", () => {
    expect(parseTND(0.1 + 0.2)).toBe(300);
    expect(parseTND("1.005")).toBe(1005);
    expect(parseTND(19.99)).toBe(19990);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", " ", "abc", "-5", "1,234.567", "1.2.3", "4 5a", ".", "1e3"]) {
      expect(parseTND(bad), bad).toBeNull();
    }
    expect(parseTND(Number.NaN)).toBeNull();
    expect(parseTND(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseTND("9".repeat(20))).toBeNull();
  });
});

describe("toTNDInputValue", () => {
  it("renders millimes as an editable TND string", () => {
    expect(toTNDInputValue(45500)).toBe("45.500");
    expect(toTNDInputValue(5)).toBe("0.005");
    expect(toTNDInputValue(0)).toBe("0.000");
  });

  it("round-trips with parseTND", () => {
    for (const m of [0, 1, 999, 1000, 45500, 123456789]) {
      expect(parseTND(toTNDInputValue(m))).toBe(m);
    }
  });
});
