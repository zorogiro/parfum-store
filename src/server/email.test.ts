import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sent: [] as { to: string; subject: string; text: string }[],
  allowCustomer: true,
  consumed: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: { to: string; subject: string; text: string }) => {
        state.sent.push({ to: m.to, subject: m.subject, text: m.text });
        return { error: null };
      },
    };
  },
}));
vi.mock("@/lib/db", () => ({
  db: { setting: { findUnique: async () => ({ value: "owner@example.com" }) } },
}));
vi.mock("./rate-limiters", () => ({
  customerEmailLimiter: {
    consume: async (key: string) => {
      state.consumed.push(key);
      return state.allowCustomer;
    },
  },
}));
vi.mock("server-only", () => ({}));

import { sendOrderEmails } from "./email";

const order = {
  number: "ORD-000001",
  customerName: "Test",
  phone: "+21622123456",
  email: "Victim@Example.com",
  governorate: "Tunis",
  city: "Tunis",
  address: "1 rue X",
  items: [{ productName: "P", variantLabel: "50 ml", unitPrice: 1000, quantity: 1 }],
  subtotal: 1000,
  shippingFee: 0,
  total: 1000,
};

beforeEach(() => {
  state.sent = [];
  state.consumed = [];
  state.allowCustomer = true;
  process.env.RESEND_API_KEY = "re_test";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("sendOrderEmails", () => {
  it("sends the merchant notification and the customer confirmation", async () => {
    await sendOrderEmails(order);
    expect(state.sent.map((m) => m.to).sort()).toEqual(["Victim@Example.com", "owner@example.com"]);
    expect(state.consumed).toEqual(["victim@example.com"]); // limiter key is normalized
  });

  it("skips ONLY the customer email once the per-address limit is reached", async () => {
    state.allowCustomer = false;
    await sendOrderEmails(order);
    expect(state.sent.map((m) => m.to)).toEqual(["owner@example.com"]);
  });

  it("does not touch the limiter when the customer gave no email", async () => {
    await sendOrderEmails({ ...order, email: undefined });
    expect(state.consumed).toEqual([]);
    expect(state.sent.map((m) => m.to)).toEqual(["owner@example.com"]);
  });

  it("tells the recipient to ignore the email if they did not order", async () => {
    await sendOrderEmails(order);
    const customer = state.sent.find((m) => m.to === "Victim@Example.com")!;
    expect(customer.text).toContain("Si vous n'avez pas passé cette commande");
  });
});
