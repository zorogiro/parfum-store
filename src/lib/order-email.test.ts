import { describe, expect, it } from "vitest";
import {
  buildCustomerEmail,
  buildMerchantEmail,
  escapeHtml,
  type OrderEmailData,
} from "./order-email";

const evil = `<script>alert("x")</script> & 'q'`;

const data: OrderEmailData = {
  number: "ORD-000042",
  customerName: evil,
  phone: "+21622123456",
  email: "client@example.com",
  governorate: "Tunis",
  city: "<b>Ville</b>",
  address: `"><img src=x onerror=alert(1)>`,
  notes: evil,
  items: [{ productName: "<i>Parfum</i>", variantLabel: evil, unitPrice: 45500, quantity: 2 }],
  subtotal: 91000,
  shippingFee: 8000,
  total: 99000,
};

describe("escapeHtml", () => {
  it("escapes the five dangerous characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("order emails", () => {
  it.each([
    ["merchant", buildMerchantEmail(data)],
    ["customer", buildCustomerEmail(data)],
  ])("%s HTML never contains raw user markup", (_name, email) => {
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<b>Ville");
    expect(email.html).not.toContain("<i>Parfum");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("merchant email shows the totals and number", () => {
    const email = buildMerchantEmail(data);
    expect(email.subject).toContain("ORD-000042");
    expect(email.html).toContain("Total à encaisser : 99,000 TND");
  });

  it("shows free shipping and keeps the subject on one line", () => {
    const email = buildMerchantEmail({ ...data, shippingFee: 0, customerName: "a\r\nBcc: x" });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain("Gratuite");
  });
});
