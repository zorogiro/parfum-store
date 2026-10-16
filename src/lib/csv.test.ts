import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, csvRow, neutralizeFormula, toCsv } from "./csv";

describe("formula injection guard", () => {
  it.each(["=SUM(A1)", "+216 22 123 456", "-2+3", "@cmd", "\tTAB", "\rCR"])(
    "prefixes %j with a single quote",
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  it("leaves harmless text alone, including a dash or plus in the middle", () => {
    expect(neutralizeFormula("Tunis")).toBe("Tunis");
    expect(neutralizeFormula("rue 5-7 + bis")).toBe("rue 5-7 + bis");
    expect(neutralizeFormula("")).toBe("");
  });

  it("guards before quoting, so a quoted cell still starts with the apostrophe", () => {
    expect(csvCell('=HYPERLINK("http://x";"y")')).toBe(`"'=HYPERLINK(""http://x"";""y"")"`);
  });

  it("does not touch numbers (generated, never user text)", () => {
    expect(csvCell(12500)).toBe("12500");
    expect(csvCell(0)).toBe("0");
  });
});

describe("csvCell quoting", () => {
  it("quotes cells containing the delimiter, quotes, commas or line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('il a dit "oui"')).toBe('"il a dit ""oui"""');
    expect(csvCell("ligne1\nligne2")).toBe('"ligne1\nligne2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("leaves simple text and accents unquoted", () => {
    expect(csvCell("Élégance à Sfax")).toBe("Élégance à Sfax");
  });

  it("writes null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const out = toCsv(["a", "b"], [["1", "x;y"]]);
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(`${CSV_BOM}a;b\r\n1;"x;y"\r\n`);
  });

  it("csvRow joins with the delimiter", () => {
    expect(csvRow(["a", 2, null, "=x"])).toBe("a;2;;'=x");
  });
});
