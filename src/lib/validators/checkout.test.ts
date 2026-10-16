import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./checkout";

const valid = {
  customerName: "  Client Test  ",
  phone: "22 123 456",
  email: "",
  governorate: "Tunis",
  city: "La Marsa",
  address: "12 rue de test",
  notes: "",
  website: "",
  idempotencyKey: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
  items: [{ variantId: "abc123", quantity: 2 }],
};

describe("checkoutSchema", () => {
  it("accepts a valid payload, trims and normalizes", () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.customerName).toBe("Client Test");
      expect(r.data.phone).toBe("+21622123456");
      expect(r.data.email).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });

  it("accepts an optional valid email and notes", () => {
    const r = checkoutSchema.safeParse({ ...valid, email: "a@b.tn", notes: "Sonner 2 fois" });
    expect(r.success && r.data.email).toBe("a@b.tn");
  });

  it("rejects a filled honeypot", () => {
    expect(checkoutSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });

  it("accepts a missing honeypot field", () => {
    const { website, ...rest } = valid;
    void website;
    expect(checkoutSchema.safeParse(rest).success).toBe(true);
  });

  it.each([
    ["customerName", ""],
    ["customerName", "A"],
    ["customerName", "x".repeat(81)],
    ["phone", "123"],
    ["phone", ""],
    ["email", "not-an-email"],
    ["governorate", ""],
    ["city", "L"],
    ["address", "rue"],
    ["address", "x".repeat(251)],
    ["notes", "x".repeat(501)],
    ["idempotencyKey", "not-a-uuid"],
    ["idempotencyKey", ""],
  ])("rejects %s = %j", (field, value) => {
    const r = checkoutSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe(field);
  });

  it.each(["customerName", "phone", "governorate", "city", "address", "idempotencyKey", "items"])(
    "rejects a missing %s",
    (field) => {
      const copy: Record<string, unknown> = { ...valid };
      delete copy[field];
      expect(checkoutSchema.safeParse(copy).success).toBe(false);
    },
  );

  it("rejects an empty cart, too many lines and bad quantities", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...valid, items: [{ variantId: "a", quantity: 11 }] }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...valid, items: [{ variantId: "a", quantity: 0 }] }).success,
    ).toBe(false);
  });

  it("ignores client-sent prices and totals (stripped)", () => {
    const r = checkoutSchema.safeParse({
      ...valid,
      total: 1,
      items: [{ variantId: "a", quantity: 1, unitPrice: 1 }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("total" in r.data).toBe(false);
      expect("unitPrice" in r.data.items[0]).toBe(false);
    }
  });
});
