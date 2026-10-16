import { describe, expect, it } from "vitest";
import {
  buildProductJsonLd,
  metaDescription,
  millimesToPrice,
  serializeJsonLd,
} from "./product-jsonld";

const base = {
  name: "Nuit d'Oud",
  description: "Un parfum boisé.",
  brand: "Maison Atlas",
  images: ["https://res.cloudinary.com/x/image/upload/a.jpg"],
  url: "https://shop.tn/p/nuit-d-oud",
};

describe("millimesToPrice", () => {
  it("converts millimes to a 3-decimal TND string without float drift", () => {
    expect(millimesToPrice(45500)).toBe("45.500");
    expect(millimesToPrice(190000)).toBe("190.000");
    expect(millimesToPrice(5)).toBe("0.005");
    expect(millimesToPrice(1234567)).toBe("1234.567");
    expect(millimesToPrice(0)).toBe("0.000");
  });
});

describe("buildProductJsonLd", () => {
  it("builds a single Offer for one variant", () => {
    const ld = buildProductJsonLd({
      ...base,
      variants: [{ sku: "SAC-1", label: "Unique", price: 145000, stock: 6 }],
    });
    expect(ld["@type"]).toBe("Product");
    expect(ld.sku).toBe("SAC-1");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Maison Atlas" });
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "TND",
      price: "145.000",
      availability: "https://schema.org/InStock",
      url: base.url,
    });
  });

  it("marks a sold-out single variant OutOfStock", () => {
    const ld = buildProductJsonLd({
      ...base,
      variants: [{ sku: "A", label: "A", price: 1000, stock: 0 }],
    });
    expect(ld.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("builds an AggregateOffer with low/high price for several variants", () => {
    const ld = buildProductJsonLd({
      ...base,
      variants: [
        { sku: "N-50", label: "50 ml", price: 120000, stock: 0 },
        { sku: "N-100", label: "100 ml", price: 190000, stock: 4 },
      ],
    });
    expect(ld.offers).toMatchObject({
      "@type": "AggregateOffer",
      priceCurrency: "TND",
      lowPrice: "120.000",
      highPrice: "190.000",
      offerCount: 2,
      availability: "https://schema.org/InStock",
    });
    const offers = (ld.offers as { offers: { sku: string; availability: string }[] }).offers;
    expect(offers.map((o) => [o.sku, o.availability])).toEqual([
      ["N-50", "https://schema.org/OutOfStock"],
      ["N-100", "https://schema.org/InStock"],
    ]);
  });

  it("is OutOfStock overall when every variant is sold out", () => {
    const ld = buildProductJsonLd({
      ...base,
      variants: [
        { sku: "A", label: "A", price: 1000, stock: 0 },
        { sku: "B", label: "B", price: 2000, stock: 0 },
      ],
    });
    expect(ld.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("omits optional fields that are empty", () => {
    const ld = buildProductJsonLd({
      ...base,
      description: "  ",
      brand: null,
      images: [],
      variants: [],
    });
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("description");
    expect(ld).not.toHaveProperty("brand");
    expect(ld).not.toHaveProperty("offers");
    expect(ld).not.toHaveProperty("sku");
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so product text cannot close the script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script");
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>");
  });

  it("escapes line separators", () => {
    expect(serializeJsonLd({ a: "x\u2028y\u2029" })).not.toMatch(/[\u2028\u2029]/);
  });
});

describe("metaDescription", () => {
  it("collapses whitespace and keeps short text as is", () => {
    expect(metaDescription("  Un   parfum\n boisé. ", "fallback")).toBe("Un parfum boisé.");
  });

  it("truncates to at most 155 characters", () => {
    const out = metaDescription("mot ".repeat(100), "fallback");
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("…")).toBe(true);
  });

  it("falls back when empty", () => {
    expect(metaDescription("   ", "fallback")).toBe("fallback");
  });
});
