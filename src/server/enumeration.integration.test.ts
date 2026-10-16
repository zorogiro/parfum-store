import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Enumeration / leak checks against the REAL database in DATABASE_URL (dev branch only): the
 * order confirmation link and /suivi must not reveal whether an order number exists, and must
 * not return more than they need. It creates one order of its own and deletes it afterwards.
 * Skipped unless E2E_ALLOW_DB_WRITES=1.
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";

const state = vi.hoisted(() => ({ ip: "10.0.0.1" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.ip }),
}));

describe.skipIf(!enabled)("order enumeration and leaks (database)", { timeout: 60_000 }, () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let trackOrder: typeof import("./tracking").trackOrder;
  let findOrderForConfirmation: typeof import("./order-lookup").findOrderForConfirmation;
  let confirmationLinkIsValid: typeof import("./order-lookup").confirmationLinkIsValid;
  let generateTrackingToken: typeof import("./order-token").generateTrackingToken;

  const tag = randomUUID().slice(0, 8);
  const number = `ORD-9${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`;
  const phone = `+2169${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`.slice(0, 12);
  let token = "";
  let orderId = "";
  const runOctet = 1 + Math.floor(Math.random() * 250);
  let n = 0;
  const freshIp = () => (state.ip = `10.${runOctet}.${Math.floor(++n / 250)}.${n % 250}`);

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ trackOrder } = await import("./tracking"));
    ({ findOrderForConfirmation, confirmationLinkIsValid } = await import("./order-lookup"));
    ({ generateTrackingToken } = await import("./order-token"));
    token = generateTrackingToken();
    // Needs a variant to attach an item to.
    const variant = await db.variant.findFirstOrThrow({ select: { id: true } });
    const order = await db.order.create({
      data: {
        number,
        trackingToken: token,
        customerName: `TEST ENUM ${tag}`,
        phone,
        governorate: "Tunis",
        city: "Ville Test",
        address: "1 rue secrète des tests",
        subtotal: 1000,
        shippingFee: 0,
        total: 1000,
        items: {
          create: [
            {
              variantId: variant.id,
              productName: "P",
              variantLabel: "V",
              unitPrice: 1000,
              quantity: 1,
            },
          ],
        },
      },
      select: { id: true },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    if (orderId) await db.order.delete({ where: { id: orderId } });
  });

  describe("/suivi (trackOrder)", () => {
    it("answers an unknown number, a wrong phone and a malformed input identically", async () => {
      const unknown = await trackOrder({ number: "ORD-123", phone });
      freshIp();
      const wrongPhone = await trackOrder({ number, phone: "+21620000000" });
      freshIp();
      const malformed = await trackOrder({ number: "not-a-number", phone: "abc" });
      freshIp();
      const garbage = await trackOrder("nonsense");
      for (const result of [unknown, wrongPhone, malformed, garbage]) {
        expect(result).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
      }
      expect(
        new Set([unknown, wrongPhone, malformed, garbage].map((r) => JSON.stringify(r))).size,
      ).toBe(1);
    });

    it("with the right number and phone returns the status, never the address, name or phone", async () => {
      freshIp();
      const result = await trackOrder({ number, phone });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const json = JSON.stringify(result);
      expect(json).not.toContain("rue secrète");
      expect(json).not.toContain("TEST ENUM");
      expect(json).not.toContain(phone);
      expect(json).not.toContain(token);
      expect(Object.keys(result.order)).not.toContain("address");
      expect(Object.keys(result.order)).not.toContain("trackingToken");
    });

    it("rate limits lookups per IP (11th lookup in 15 minutes is refused)", async () => {
      freshIp();
      const codes: string[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await trackOrder({ number: "ORD-1", phone });
        codes.push(r.ok ? "OK" : r.code);
      }
      expect(codes.slice(0, 10).every((c) => c === "NOT_FOUND")).toBe(true);
      expect(codes[10]).toBe("RATE_LIMITED");
    });
  });

  describe("order confirmation link", () => {
    it("opens only with the right number AND token", async () => {
      expect(await findOrderForConfirmation(number, token)).not.toBeNull();
      expect(await confirmationLinkIsValid(number, token)).toBe(true);
    });

    it("a wrong token, a wrong number, a missing or malformed value are all null/false", async () => {
      const other = generateTrackingToken();
      const cases: [unknown, unknown][] = [
        [number, other],
        ["ORD-1", token],
        [number, null],
        [null, token],
        [number, "short"],
        [`${number}' OR '1'='1`, token],
        [number, `${token}x`],
        [undefined, undefined],
      ];
      for (const [num, tok] of cases) {
        expect(await findOrderForConfirmation(num, tok)).toBeNull();
        expect(await confirmationLinkIsValid(num, tok)).toBe(false);
      }
    });

    it("the page data never includes the token", async () => {
      const found = await findOrderForConfirmation(number, token);
      expect(JSON.stringify(found)).not.toContain(token);
      expect(Object.keys(found ?? {})).not.toContain("trackingToken");
    });
  });
});
