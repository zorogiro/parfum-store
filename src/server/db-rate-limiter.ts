import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import type { RateLimiter } from "@/lib/rate-limit";

/** Storage behind DbRateLimiter. Injectable so the failure behaviour can be unit tested. */
export interface BucketStore {
  /** Atomically add one to the bucket (starting a new window if expired); returns the new count. */
  hit(key: string, windowMs: number): Promise<number>;
  /** Count of the live (unexpired) bucket, 0 when absent or expired. */
  count(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  /** Delete buckets that expired a while ago. */
  cleanup(): Promise<void>;
}

/**
 * Single atomic statement: concurrent requests (on any instance) cannot lose an increment.
 * The window clock is the database clock, so instances with skewed clocks agree.
 */
export const prismaBucketStore: BucketStore = {
  async hit(key, windowMs) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + (${windowMs}::double precision * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC')
                       THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC')
                         THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count"`;
    return Number(rows[0].count);
  },
  async count(key) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      SELECT "count" FROM "RateLimitBucket"
      WHERE "key" = ${key} AND "resetAt" > (now() AT TIME ZONE 'UTC')`;
    return rows[0] ? Number(rows[0].count) : 0;
  },
  async delete(key) {
    await db.rateLimitBucket.deleteMany({ where: { key } });
  },
  async cleanup() {
    await db.$executeRaw`
      DELETE FROM "RateLimitBucket"
      WHERE "resetAt" < (now() AT TIME ZONE 'UTC') - interval '1 hour'`;
  },
};

export interface DbRateLimiterOptions {
  /** Namespace, so two limiters never share a counter for the same subject. */
  name: string;
  maxFailures: number;
  windowMs: number;
  /**
   * What to do when the database is unavailable:
   * - "open": never block (checkout, tracking: a broken limiter must not stop a real order);
   * - "closed": block (admin login: a broken limiter must not allow unlimited guessing).
   */
  onError: "open" | "closed";
  store?: BucketStore;
}

const CLEANUP_EVERY_MS = 5 * 60 * 1000;
let lastCleanup = 0;

/** Never log keys (they contain IPs, phones, emails): only the kind of failure. */
function logFailure(name: string, action: string, error: unknown) {
  const kind = error instanceof Error ? error.name : "unknown";
  console.error(`[rate-limit] ${name}.${action} failed (${kind})`);
}

export class DbRateLimiter implements RateLimiter {
  private readonly store: BucketStore;

  constructor(private readonly options: DbRateLimiterOptions) {
    this.store = options.store ?? prismaBucketStore;
  }

  /**
   * HMAC of "<name>\0<subject>": no IP, phone or email is stored in clear, and a stolen table
   * cannot be reversed by hashing every possible phone number.
   */
  private bucketKey(key: string): string {
    const secret = process.env.AUTH_SECRET ?? "rate-limit-dev-secret";
    return createHmac("sha256", secret).update(`${this.options.name}\0${key}`).digest("base64url");
  }

  async isBlocked(key: string): Promise<boolean> {
    try {
      return (await this.store.count(this.bucketKey(key))) >= this.options.maxFailures;
    } catch (error) {
      logFailure(this.options.name, "isBlocked", error);
      return this.options.onError === "closed";
    }
  }

  async recordFailure(key: string): Promise<void> {
    try {
      await this.store.hit(this.bucketKey(key), this.options.windowMs);
      await this.maybeCleanup();
    } catch (error) {
      logFailure(this.options.name, "recordFailure", error);
    }
  }

  async consume(key: string): Promise<boolean> {
    try {
      const count = await this.store.hit(this.bucketKey(key), this.options.windowMs);
      await this.maybeCleanup();
      return count <= this.options.maxFailures;
    } catch (error) {
      logFailure(this.options.name, "consume", error);
      return this.options.onError === "open";
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.store.delete(this.bucketKey(key));
    } catch (error) {
      logFailure(this.options.name, "reset", error);
    }
  }

  /** Opportunistic cleanup of long-expired rows, at most once per 5 minutes per instance. */
  private async maybeCleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_EVERY_MS) return;
    lastCleanup = now;
    try {
      await this.store.cleanup();
    } catch (error) {
      logFailure(this.options.name, "cleanup", error);
    }
  }
}
