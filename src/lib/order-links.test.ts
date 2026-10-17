import { describe, expect, it } from "vitest";
import { phoneDigits, telHref, whatsappHref } from "./order-links";

describe("order links", () => {
  it("keeps digits only, with the country code", () => {
    expect(phoneDigits("+216 22 123 456")).toBe("21622123456");
    expect(telHref("+21622123456")).toBe("tel:+21622123456");
    expect(whatsappHref("+21622123456")).toBe("https://wa.me/21622123456");
  });

  it("URL-encodes the prefilled message", () => {
    expect(whatsappHref("+21622123456", "Bonjour & merci ? 100%")).toBe(
      "https://wa.me/21622123456?text=Bonjour%20%26%20merci%20%3F%20100%25",
    );
  });
});
