import { describe, expect, it } from "vitest";
import { normalizeTunisianPhone } from "./phone";

describe("normalizeTunisianPhone", () => {
  it.each([
    ["+216 22 123 456", "+21622123456"],
    ["+21622123456", "+21622123456"],
    ["00216 22 123 456", "+21622123456"],
    ["216 22 123 456", "+21622123456"],
    ["22123456", "+21622123456"],
    ["22.123.456", "+21622123456"],
    ["22-123-456", "+21622123456"],
    ["  +216-98.765 432 ", "+21698765432"],
    ["21612345", "+21621612345"], // national number starting with 216 is not a country code
  ])("accepts %s", (input, expected) => {
    expect(normalizeTunisianPhone(input)).toBe(expected);
  });

  it.each([
    "2",
    "2212345",
    "221234567",
    "+216 2212345",
    "+216 221234567",
    "216221234",
    "0022122123456",
  ])("rejects wrong length %s", (input) => {
    expect(normalizeTunisianPhone(input)).toBeNull();
  });

  it.each(["01234567", "11234567", "61234567", "81234567", "+216 11234567", "+216 81234567"])(
    "rejects invalid prefix %s",
    (input) => {
      expect(normalizeTunisianPhone(input)).toBeNull();
    },
  );

  it.each(["", "   ", "abc", "22 123 45a", "++21622123456", "+33 6 12 34 56 78", "2212 3456 7"])(
    "rejects garbage %j",
    (input) => {
      expect(normalizeTunisianPhone(input)).toBeNull();
    },
  );

  it("accepts every valid first digit", () => {
    for (const d of "234579") expect(normalizeTunisianPhone(`${d}1234567`)).toBe(`+216${d}1234567`);
  });
});
