import { toTNDInputValue } from "@/lib/money";

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

export type JsonLdVariant = { sku: string; label: string; price: number; stock: number };

export type ProductJsonLdInput = {
  name: string;
  description: string;
  brand: string | null;
  /** Absolute image URLs, cover first. */
  images: string[];
  /** Absolute product URL. */
  url: string;
  variants: JsonLdVariant[];
};

/** Millimes -> schema.org price string with 3 decimals (integer math, no floats): 45500 -> "45.500". */
export function millimesToPrice(millimes: number): string {
  return toTNDInputValue(millimes);
}

function availability(stock: number) {
  return stock > 0 ? IN_STOCK : OUT_OF_STOCK;
}

/** Single variant -> Offer, several -> AggregateOffer (with one Offer per variant). */
export function buildProductJsonLd(input: ProductJsonLdInput) {
  const { variants, url } = input;
  const description = input.description.replace(/\s+/g, " ").trim();

  const offer = (v: JsonLdVariant) => ({
    "@type": "Offer",
    url,
    sku: v.sku,
    priceCurrency: "TND",
    price: millimesToPrice(v.price),
    availability: availability(v.stock),
  });

  let offers: Record<string, unknown> | undefined;
  if (variants.length === 1) {
    offers = offer(variants[0]);
  } else if (variants.length > 1) {
    const prices = variants.map((v) => v.price);
    offers = {
      "@type": "AggregateOffer",
      url,
      priceCurrency: "TND",
      lowPrice: millimesToPrice(Math.min(...prices)),
      highPrice: millimesToPrice(Math.max(...prices)),
      offerCount: variants.length,
      availability: availability(Math.max(...variants.map((v) => v.stock))),
      offers: variants.map(offer),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.images.length > 0 && { image: input.images }),
    ...(description && { description }),
    ...(input.brand && { brand: { "@type": "Brand", name: input.brand } }),
    ...(variants.length > 0 && { sku: variants[0].sku }),
    url,
    ...(offers && { offers }),
  };
}

/**
 * JSON for a <script type="application/ld+json"> tag. "<" is escaped so product text can never
 * close the tag (</script>) or open a comment; U+2028/2029 are escaped for older parsers.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

const META_DESCRIPTION_MAX = 155;

/** Plain-text meta description: whitespace collapsed, at most 155 characters (ellipsis included). */
export function metaDescription(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  if (clean.length <= META_DESCRIPTION_MAX) return clean;
  return `${clean.slice(0, META_DESCRIPTION_MAX - 1).trimEnd()}…`;
}
