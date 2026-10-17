import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

// The real db module needs DATABASE_URL; these tests only use injected stores.
vi.mock("@/lib/db", () => ({ db: {} }));

import { DbRateLimiter, type BucketStore } from "./db-rate-limiter";

/** In-memory BucketStore with a controllable clock, mimicking the SQL semantics. */
function fakeStore() {
  let now = 1_000_000;
  const rows = new Map<string, { count: number; resetAt: number }>();
  const store: BucketStore = {
    async hit(key, windowMs) {
      const row = rows.get(key);
      if (!row || row.resetAt <= now) {
        rows.set(key, { count: 1, resetAt: now + windowMs });
        return 1;
      }
      row.count += 1;
      return row.count;
    },
    async count(key) {
      const row = rows.get(key);
      return row && row.resetAt > now ? row.count : 0;
    },
    async delete(key) {
      rows.delete(key);
    },
    async cleanup() {},
  };
  return { store, rows, advance: (ms: number) => (now += ms) };
}

const failingStore: BucketStore = {
  hit: () => Promise.reject(new Error("db down")),
  count: () => Promise.reject(new Error("db down")),
  delete: () => Promise.reject(new Error("db down")),
  cleanup: () => Promise.reject(new Error("db down")),
};

const options = { name: "t", maxFailures: 3, windowMs: 60_000 } as const;

afterEach(() => vi.restoreAllMocks());

describe("DbRateLimiter", () => {
  it("blocks after maxFailures and resets after the window", async () => {
    const { store, advance } = fakeStore();
    const limiter = new DbRateLimiter({ ...options, onError: "open", store });
    for (let i = 0; i < 2; i++) await limiter.recordFailure("k");
    expect(await limiter.isBlocked("k")).toBe(false);
    await limiter.recordFailure("k");
    expect(await limiter.isBlocked("k")).toBe(true);
    advance(60_000);
    expect(await limiter.isBlocked("k")).toBe(false);
  });

  it("reset clears the counter and keys are independent", async () => {
    const { store } = fakeStore();
    const limiter = new DbRateLimiter({ ...options, onError: "open", store });
    for (let i = 0; i < 3; i++) await limiter.recordFailure("a");
    expect(await limiter.isBlocked("b")).toBe(false);
    await limiter.reset("a");
    expect(await limiter.isBlocked("a")).toBe(false);
  });

  it("namespaces keys per limiter", async () => {
    const { store } = fakeStore();
    const a = new DbRateLimiter({ ...options, name: "a", onError: "open", store });
    const b = new DbRateLimiter({ ...options, name: "b", onError: "open", store });
    for (let i = 0; i < 3; i++) await a.recordFailure("same");
    expect(await a.isBlocked("same")).toBe(true);
    expect(await b.isBlocked("same")).toBe(false);
  });

  it("never stores the subject in clear", async () => {
    const { store, rows } = fakeStore();
    const limiter = new DbRateLimiter({ ...options, onError: "open", store });
    await limiter.recordFailure("+21622123456");
    await limiter.recordFailure("203.0.113.9|admin@example.com");
    const keys = [...rows.keys()].join(" ");
    expect(keys).not.toContain("21622123456");
    expect(keys).not.toContain("203.0.113.9");
    expect(keys).not.toContain("admin@example.com");
  });

  it("consume allows exactly maxFailures uses, even when concurrent", async () => {
    const { store } = fakeStore();
    const limiter = new DbRateLimiter({ ...options, onError: "open", store });
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.consume("k")));
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  describe("when the database is unavailable", () => {
    it("fails OPEN for checkout-style limiters, and logs only the kind of error", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const limiter = new DbRateLimiter({ ...options, onError: "open", store: failingStore });
      expect(await limiter.isBlocked("secret-phone")).toBe(false);
      expect(await limiter.consume("secret-phone")).toBe(true);
      await expect(limiter.recordFailure("secret-phone")).resolves.toBeUndefined();
      await expect(limiter.reset("secret-phone")).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalled();
      expect(JSON.stringify(spy.mock.calls)).not.toContain("secret-phone");
    });

    it("fails CLOSED for the admin login limiter", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const limiter = new DbRateLimiter({ ...options, onError: "closed", store: failingStore });
      expect(await limiter.isBlocked("k")).toBe(true);
      expect(await limiter.consume("k")).toBe(false);
    });
  });
});

describe("InMemoryRateLimiter.consume", () => {
  it("allows maxFailures uses then refuses", async () => {
    const limiter = new InMemoryRateLimiter({ maxFailures: 2, windowMs: 1000 });
    expect(await limiter.consume("k")).toBe(true);
    expect(await limiter.consume("k")).toBe(true);
    expect(await limiter.consume("k")).toBe(false);
  });
});
