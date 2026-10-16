import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Integration test for the Postgres rate limiter against the REAL database in DATABASE_URL
 * (dev branch only). It writes to RateLimitBucket under a random limiter name and deletes the
 * rows it created afterwards. Skipped unless E2E_ALLOW_DB_WRITES=1.
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";

describe.skipIf(!enabled)("DbRateLimiter (database)", { timeout: 30_000 }, () => {
  const name = `itest-${randomUUID().slice(0, 8)}`;
  const usedKeys = new Set<string>();

  afterAll(async () => {
    const { db } = await import("@/lib/db");
    await db.rateLimitBucket.deleteMany({ where: { key: { in: [...usedKeys] } } });
  });

  async function make(max: number, windowMs: number) {
    const { DbRateLimiter, prismaBucketStore } = await import("./db-rate-limiter");
    // Remember the physical keys so the test deletes exactly its own rows.
    const store = {
      ...prismaBucketStore,
      hit: (key: string, ms: number) => {
        usedKeys.add(key);
        return prismaBucketStore.hit(key, ms);
      },
    };
    return new DbRateLimiter({ name, maxFailures: max, windowMs, onError: "open", store });
  }

  it("counts atomically under 30 concurrent hits (no lost updates)", async () => {
    const limiter = await make(1000, 60_000);
    await Promise.all(Array.from({ length: 30 }, () => limiter.recordFailure("c1")));
    const { db } = await import("@/lib/db");
    const rows = await db.rateLimitBucket.findMany({ where: { key: { in: [...usedKeys] } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(30);
  });

  it("consume lets exactly `max` of 25 concurrent callers through", async () => {
    const limiter = await make(5, 60_000);
    const results = await Promise.all(Array.from({ length: 25 }, () => limiter.consume("c2")));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await limiter.isBlocked("c2")).toBe(true);
  });

  it("blocks, resets and expires", async () => {
    const limiter = await make(2, 1500);
    await limiter.recordFailure("c3");
    expect(await limiter.isBlocked("c3")).toBe(false);
    await limiter.recordFailure("c3");
    expect(await limiter.isBlocked("c3")).toBe(true);
    await limiter.reset("c3");
    expect(await limiter.isBlocked("c3")).toBe(false);

    await limiter.recordFailure("c4");
    await limiter.recordFailure("c4");
    expect(await limiter.isBlocked("c4")).toBe(true);
    await new Promise((r) => setTimeout(r, 1800));
    expect(await limiter.isBlocked("c4")).toBe(false);
    await limiter.recordFailure("c4");
    expect(await limiter.isBlocked("c4")).toBe(false); // a fresh window starts at 1
  }, 20_000);
});
