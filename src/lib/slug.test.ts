import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("transliterates accents", () => {
    expect(slugify("Éau de Parfum Élégante")).toBe("eau-de-parfum-elegante");
    expect(slugify("Crème brûlée à la façon")).toBe("creme-brulee-a-la-facon");
    expect(slugify("Cœur d'œillet")).toBe("coeur-doeillet");
  });

  it("replaces spaces and punctuation with single dashes", () => {
    expect(slugify("  Dior   Sauvage -- 100ml!  ")).toBe("dior-sauvage-100ml");
    expect(slugify("T-shirt / Homme (L)")).toBe("t-shirt-homme-l");
  });

  it("drops apostrophes and spells out ampersands", () => {
    expect(slugify("L'Homme")).toBe("lhomme");
    expect(slugify("Montres & Bijoux")).toBe("montres-et-bijoux");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("   ")).toBe("");
    expect(slugify("عطر")).toBe("");
  });

  it("never ends with a dash after truncation", () => {
    const slug = slugify(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("keeps the base when free", () => {
    expect(uniqueSlug("sauvage", ["eros"])).toBe("sauvage");
  });

  it("appends the first free numeric suffix on duplicates", () => {
    expect(uniqueSlug("sauvage", ["sauvage"])).toBe("sauvage-2");
    expect(uniqueSlug("sauvage", ["sauvage", "sauvage-2", "sauvage-3"])).toBe("sauvage-4");
    expect(uniqueSlug("sauvage", ["sauvage", "sauvage-3"])).toBe("sauvage-2");
  });

  it("uses the fallback for an empty base", () => {
    expect(uniqueSlug("", [], "produit")).toBe("produit");
    expect(uniqueSlug("", ["produit"], "produit")).toBe("produit-2");
  });
});
