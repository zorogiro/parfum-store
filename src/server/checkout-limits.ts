import { InMemoryRateLimiter, type RateLimiter } from "@/lib/rate-limit";

/**
 * Checkout / tracking abuse limits, built on the same interface as the login limiter.
 *
 * WARNING: these are in-memory, per server instance. On serverless hosting (Vercel) every
 * instance has its own counters that are lost on cold start, so they only slow abuse down;
 * they are not a hard limit. Swap InMemoryRateLimiter for a DB / Redis implementation of
 * RateLimiter before relying on them. Stock safety does not depend on them (it is enforced
 * by the conditional UPDATE inside the order transaction).
 *
 * The RateLimiter interface counts "failures"; here each created order (or tracking lookup)
 * is recorded as one hit against its key.
 */
const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** Max 5 orders per hour per client IP. */
export const orderIpLimiter: RateLimiter = new InMemoryRateLimiter({
  maxFailures: 5,
  windowMs: HOUR_MS,
});

/** Max 5 orders per hour per normalized phone number. */
export const orderPhoneLimiter: RateLimiter = new InMemoryRateLimiter({
  maxFailures: 5,
  windowMs: HOUR_MS,
});

/** Coarse limit on rejected attempts (invalid payloads, honeypot, stock conflicts): 20 / 15 min / IP. */
export const checkoutFailureLimiter: RateLimiter = new InMemoryRateLimiter({
  maxFailures: 20,
  windowMs: QUARTER_HOUR_MS,
});

/** Order tracking lookups: 10 per 15 minutes per IP (every lookup counts, hit or miss). */
export const trackingLimiter: RateLimiter = new InMemoryRateLimiter({
  maxFailures: 10,
  windowMs: QUARTER_HOUR_MS,
});
