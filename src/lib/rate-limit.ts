/**
 * Failed-attempt rate limiting behind a small async interface, so the
 * in-memory implementation can later be swapped for a DB or Redis one.
 *
 * WARNING: the in-memory limiter keeps its counters in the memory of a single
 * process. It does NOT work across serverless instances (each instance has its
 * own counters, and they are lost on cold start), so on Vercel it only slows
 * down an attacker; it does not enforce a hard limit. Replace it with a shared
 * store before relying on it.
 */
export interface RateLimiter {
  /** True when `key` has used up its failed attempts in the current window. */
  isBlocked(key: string): Promise<boolean>;
  /** Record one failed attempt for `key`. */
  recordFailure(key: string): Promise<void>;
  /** Forget all failures for `key` (e.g. after a successful login). */
  reset(key: string): Promise<void>;
}

export interface InMemoryRateLimiterOptions {
  maxFailures: number;
  windowMs: number;
  /** Injectable clock, for tests. */
  now?: () => number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  private readonly now: () => number;

  constructor(private readonly options: InMemoryRateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  async isBlocked(key: string): Promise<boolean> {
    const entry = this.live(key);
    return entry !== undefined && entry.count >= this.options.maxFailures;
  }

  async recordFailure(key: string): Promise<void> {
    const entry = this.live(key);
    if (entry) {
      entry.count += 1;
    } else {
      this.sweep();
      this.entries.set(key, { count: 1, resetAt: this.now() + this.options.windowMs });
    }
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** The entry for `key`, or undefined if absent or its window has expired. */
  private live(key: string) {
    const entry = this.entries.get(key);
    if (entry && entry.resetAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Drop expired entries so the map cannot grow without bound. */
  private sweep() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

/** 5 failed attempts per 15 minutes. */
export const loginRateLimiter: RateLimiter = new InMemoryRateLimiter({
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
});
