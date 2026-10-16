import { describe, expect, it } from "vitest";
import { toTNDInputValue } from "@/lib/money";
import { adminNoteSchema, changeStatusSchema } from "./admin-orders";
import { settingsSchema } from "./settings";
import { shippingSchema } from "./shipping";

function fees(...values: string[]) {
  return values.map((fee, i) => ({ id: `z${i}`, fee }));
}

describe("shippingSchema", () => {
  it("converts TND typed by the admin to millimes", () => {
    const out = shippingSchema.parse({ zones: fees("8", "7.5", "8,250", "0"), threshold: "200" });
    expect(out.zones.map((z) => z.fee)).toEqual([8000, 7500, 8250, 0]);
    expect(out.threshold).toBe(200_000);
  });

  it("round-trips millimes -> input value -> millimes", () => {
    for (const millimes of [0, 1, 7000, 8000, 8250, 100_000]) {
      const parsed = shippingSchema.parse({
        zones: fees(toTNDInputValue(millimes)),
        threshold: "",
      });
      expect(parsed.zones[0].fee).toBe(millimes);
    }
  });

  it("accepts fees from 0 to 100 TND only", () => {
    expect(shippingSchema.safeParse({ zones: fees("100"), threshold: "" }).success).toBe(true);
    expect(shippingSchema.safeParse({ zones: fees("100.001"), threshold: "" }).success).toBe(false);
    expect(shippingSchema.safeParse({ zones: fees("-1"), threshold: "" }).success).toBe(false);
    expect(shippingSchema.safeParse({ zones: fees(""), threshold: "" }).success).toBe(false);
    expect(shippingSchema.safeParse({ zones: fees("abc"), threshold: "" }).success).toBe(false);
  });

  it("reports the error on the right row", () => {
    const result = shippingSchema.safeParse({ zones: fees("8", "x"), threshold: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["zones", 1, "fee"]);
  });

  it("empty or 0 threshold disables free shipping (0), negatives are refused", () => {
    expect(shippingSchema.parse({ zones: fees("8"), threshold: "" }).threshold).toBe(0);
    expect(shippingSchema.parse({ zones: fees("8"), threshold: "0" }).threshold).toBe(0);
    expect(shippingSchema.safeParse({ zones: fees("8"), threshold: "-5" }).success).toBe(false);
    expect(shippingSchema.safeParse({ zones: fees("8"), threshold: "x" }).success).toBe(false);
  });

  it("refuses an empty zone list", () => {
    expect(shippingSchema.safeParse({ zones: [], threshold: "" }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("stores the phone as +216XXXXXXXX, like the seed", () => {
    for (const input of ["22 123 456", "+216 22 123 456", "22123456", "0021622123456"]) {
      expect(
        settingsSchema.parse({ storePhone: input, notificationEmail: "a@b.tn" }).storePhone,
      ).toBe("+21622123456");
    }
  });

  it("refuses invalid phones and emails", () => {
    expect(
      settingsSchema.safeParse({ storePhone: "12345", notificationEmail: "a@b.tn" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ storePhone: "22123456", notificationEmail: "nope" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ storePhone: "22123456", notificationEmail: "" }).success,
    ).toBe(false);
  });

  it("trims and lower-cases the email", () => {
    expect(
      settingsSchema.parse({ storePhone: "22123456", notificationEmail: "  Orders@Example.COM " })
        .notificationEmail,
    ).toBe("orders@example.com");
  });
});

describe("order action schemas", () => {
  it("accepts known statuses only and trims the note", () => {
    const ok = changeStatusSchema.parse({
      orderId: "abc",
      toStatus: "CANCELLED",
      note: "  client injoignable ",
    });
    expect(ok.note).toBe("client injoignable");
    expect(changeStatusSchema.parse({ orderId: "abc", toStatus: "SHIPPED" }).note).toBeNull();
    expect(changeStatusSchema.safeParse({ orderId: "abc", toStatus: "DONE" }).success).toBe(false);
    expect(changeStatusSchema.safeParse({ orderId: "", toStatus: "SHIPPED" }).success).toBe(false);
    expect(
      changeStatusSchema.safeParse({ orderId: "abc", toStatus: "SHIPPED", note: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("limits the internal note to 1000 characters; empty clears it", () => {
    expect(adminNoteSchema.parse({ orderId: "abc", note: "  " }).note).toBeNull();
    expect(adminNoteSchema.safeParse({ orderId: "abc", note: "x".repeat(1000) }).success).toBe(
      true,
    );
    expect(adminNoteSchema.safeParse({ orderId: "abc", note: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});
