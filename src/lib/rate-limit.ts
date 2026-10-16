/**
 * Failed-attempt rate limiting behind a small async interface.
 *
 * Two implementations:
 * - InMemoryRateLimiter (this file): per process, lost on cold start. Only for unit tests and
 *   local tooling; on serverless it cannot enforce a hard limit.
 * - DbRateLimiter (src/server/db-rate-limiter.ts): Postgres-backed, shared by every instance.
 *   The named limiters used by the app live in src/server/rate-limiters.ts.
 */
export interface RateLimiter {
  /** True when `key` has used up its failed attempts in the current window. */
  isBlocked(key: string): Promise<boolean>;
  /** Record one failed attempt for `key`. */
  recordFailure(key: string): Promise<void>;
  /** Forget all failures for `key` (e.g. after a successful login). */
  reset(key: string): Promise<void>;
  /**
   * Atomically count one use of `key` and say whether it was within the limit. Unlike
   * isBlocked + recordFailure, concurrent callers cannot all slip under the limit.
   */
  consume(key: string): Promise<boolean>;
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

  async consume(key: string): Promise<boolean> {
    await this.recordFailure(key);
    return this.live(key)!.count <= this.options.maxFailures;
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
