import { describe, expect, it } from "vitest";
import {
  buildVariantModel,
  clampQuantity,
  colorToCss,
  discountPercent,
  initialSelection,
  isOptionAvailable,
  maxQuantity,
  resolveVariant,
  selectOption,
  stockStatus,
  type VariantInput,
} from "./product-variants";

let n = 0;
function variant(options: Record<string, unknown>, stock: number, price = 10000): VariantInput {
  n += 1;
  return {
    id: `v${n}`,
    sku: `SKU-${n}`,
    label: `L${n}`,
    price,
    compareAtPrice: null,
    stock,
    options,
  };
}

const clothing = (rows: [string, string, number][]) =>
  rows.map(([color, size, stock]) => variant({ color, size }, stock));

describe("buildVariantModel", () => {
  it("sorts sizes S..XL and colors alphabetically; drops non-distinguishing axes", () => {
    const model = buildVariantModel(
      "CLOTHING",
      clothing([
        ["Noir", "XL", 1],
        ["Noir", "S", 1],
        ["Blanc", "M", 1],
      ]),
    );
    expect(model.axes).toEqual(["color", "size"]);
    expect(model.values.size).toEqual(["S", "M", "XL"]);
    expect(model.values.color).toEqual(["Blanc", "Noir"]);

    const oneColor = buildVariantModel(
      "CLOTHING",
      clothing([
        ["Noir", "S", 1],
        ["Noir", "M", 1],
      ]),
    );
    expect(oneColor.axes).toEqual(["size"]);
  });

  it("sorts perfume volumes numerically", () => {
    const model = buildVariantModel("PERFUME", [
      variant({ volumeMl: 100 }, 1),
      variant({ volumeMl: 30 }, 1),
      variant({ volumeMl: 50 }, 1),
    ]);
    expect(model.values.volumeMl).toEqual(["30", "50", "100"]);
  });

  it("has no axes for a single variant and falls back to labels when options don't distinguish", () => {
    expect(buildVariantModel("ACCESSORY", [variant({ color: "Marron" }, 3)]).axes).toEqual([]);
    const model = buildVariantModel("ACCESSORY", [variant({}, 3), variant({}, 3)]);
    expect(model.axes).toEqual(["label"]);
  });

  it("tolerates malformed options JSON", () => {
    const model = buildVariantModel("PERFUME", [
      variant(null as never, 1),
      variant([] as never, 1),
    ]);
    expect(model.axes).toEqual(["label"]);
  });
});

describe("initialSelection", () => {
  it("preselects the first in-stock variant", () => {
    const model = buildVariantModel(
      "CLOTHING",
      clothing([
        ["Blanc", "S", 0],
        ["Blanc", "M", 0],
        ["Noir", "S", 0],
        ["Noir", "M", 4],
      ]),
    );
    expect(initialSelection(model)).toEqual({ color: "Noir", size: "M" });
  });

  it("selects nothing when a multi-variant product is sold out, and the only variant otherwise", () => {
    const soldOut = buildVariantModel("PERFUME", [
      variant({ volumeMl: 50 }, 0),
      variant({ volumeMl: 100 }, 0),
    ]);
    expect(initialSelection(soldOut)).toEqual({});
    expect(resolveVariant(soldOut, {})).toBeNull();

    const single = buildVariantModel("ACCESSORY", [variant({ color: "Marron" }, 0)]);
    expect(resolveVariant(single, initialSelection(single))?.stock).toBe(0);
  });
});

describe("option availability", () => {
  const model = buildVariantModel(
    "CLOTHING",
    clothing([
      ["Blanc", "S", 5],
      ["Blanc", "M", 0],
      ["Noir", "M", 2],
      // Noir has no S, and Blanc has no L: those combinations don't exist
      ["Noir", "L", 3],
    ]),
  );

  it("disables sizes that are sold out or missing for the selected color", () => {
    const blanc = { color: "Blanc", size: "S" };
    expect(isOptionAvailable(model, blanc, "size", "S")).toBe(true);
    expect(isOptionAvailable(model, blanc, "size", "M")).toBe(false); // stock 0
    expect(isOptionAvailable(model, blanc, "size", "L")).toBe(false); // combination missing

    const noir = { color: "Noir", size: "M" };
    expect(isOptionAvailable(model, noir, "size", "S")).toBe(false);
    expect(isOptionAvailable(model, noir, "size", "M")).toBe(true);
    expect(isOptionAvailable(model, noir, "size", "L")).toBe(true);
  });

  it("keeps a color enabled while any size of it is in stock", () => {
    expect(isOptionAvailable(model, { color: "Noir", size: "M" }, "color", "Blanc")).toBe(true);
  });

  it("disables a color that is sold out entirely", () => {
    const m = buildVariantModel(
      "CLOTHING",
      clothing([
        ["Blanc", "S", 0],
        ["Noir", "S", 1],
        ["Noir", "M", 1],
      ]),
    );
    expect(isOptionAvailable(m, { color: "Noir", size: "S" }, "color", "Blanc")).toBe(false);
  });
});

describe("selectOption", () => {
  const model = buildVariantModel(
    "CLOTHING",
    clothing([
      ["Blanc", "S", 5],
      ["Blanc", "M", 0],
      ["Noir", "M", 2],
      ["Noir", "L", 3],
    ]),
  );

  it("keeps the size when it exists in stock in the new color", () => {
    const next = selectOption(model, { color: "Blanc", size: "S" }, "color", "Noir");
    // Noir has no S: moves to the closest in-stock Noir variant
    expect(next.color).toBe("Noir");
    expect(resolveVariant(model, next)?.stock).toBeGreaterThan(0);

    const kept = selectOption(model, { color: "Noir", size: "M" }, "size", "L");
    expect(kept).toEqual({ color: "Noir", size: "L" });
  });

  it("moves to an in-stock size when the current one is missing in the new color", () => {
    const next = selectOption(model, { color: "Blanc", size: "S" }, "color", "Noir");
    expect(["M", "L"]).toContain(next.size);
  });

  it("ignores values that match no variant", () => {
    const sel = { color: "Noir", size: "M" };
    expect(selectOption(model, sel, "color", "Rouge")).toBe(sel);
  });

  it("resolves the matching variant, or null for a missing combination", () => {
    expect(resolveVariant(model, { color: "Noir", size: "L" })?.stock).toBe(3);
    expect(resolveVariant(model, { color: "Blanc", size: "L" })).toBeNull();
  });
});

describe("discountPercent", () => {
  it("rounds to the nearest percent", () => {
    expect(discountPercent(190000, 220000)).toBe(14);
    expect(discountPercent(89000, 110000)).toBe(19);
    expect(discountPercent(50000, 100000)).toBe(50);
  });

  it("returns null without a real discount", () => {
    expect(discountPercent(1000, null)).toBeNull();
    expect(discountPercent(1000, 1000)).toBeNull();
    expect(discountPercent(1000, 900)).toBeNull();
    expect(discountPercent(0, 900)).toBeNull();
    expect(discountPercent(99999, 100000)).toBeNull(); // rounds below 1%
  });
});

describe("stock helpers", () => {
  it("labels stock without exposing exact numbers above 3", () => {
    expect(stockStatus(0)).toEqual({ kind: "out" });
    expect(stockStatus(-2)).toEqual({ kind: "out" });
    expect(stockStatus(1)).toEqual({ kind: "low", count: 1 });
    expect(stockStatus(3)).toEqual({ kind: "low", count: 3 });
    expect(stockStatus(4)).toEqual({ kind: "in" });
    expect(stockStatus(500)).toEqual({ kind: "in" });
  });

  it("caps quantity at min(stock, 10)", () => {
    expect(maxQuantity(0)).toBe(0);
    expect(maxQuantity(2)).toBe(2);
    expect(maxQuantity(10)).toBe(10);
    expect(maxQuantity(80)).toBe(10);
    expect(clampQuantity(7, 3)).toBe(3);
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(99, 50)).toBe(10);
  });
});

describe("colorToCss", () => {
  it("maps French names, ignoring case and accents", () => {
    expect(colorToCss("Noir")).toBe("#111111");
    expect(colorToCss("  CRÈME ")).toBe("#f5efe0");
    expect(colorToCss("Doré")).toBe("#d4af37");
    expect(colorToCss("Fuchsia mat")).toBeNull();
  });
});
