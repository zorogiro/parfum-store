import { DbRateLimiter } from "./db-rate-limiter";

/**
 * Every rate limiter the app uses, all backed by the RateLimitBucket table so the limits hold
 * across serverless instances and cold starts. The RateLimiter interface counts "failures";
 * for orders, tracking lookups and emails each use is recorded as one hit against its key.
 *
 * Failure policy: if the database is unavailable the checkout, tracking and email limiters
 * fail OPEN (a broken limiter must never block a real order), the admin login limiter fails
 * CLOSED (a broken limiter must never allow unlimited password guessing).
 *
 * Stock safety does not depend on any of these (it is enforced by the conditional UPDATE in
 * the order transaction).
 */
const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** Admin login: 5 failed attempts per 15 minutes per IP + email. */
export const loginRateLimiter = new DbRateLimiter({
  name: "login",
  maxFailures: 5,
  windowMs: QUARTER_HOUR_MS,
  onError: "closed",
});

/** Max 5 orders per hour per client IP. */
export const orderIpLimiter = new DbRateLimiter({
  name: "order-ip",
  maxFailures: 5,
  windowMs: HOUR_MS,
  onError: "open",
});

/** Max 5 orders per hour per normalized phone number. */
export const orderPhoneLimiter = new DbRateLimiter({
  name: "order-phone",
  maxFailures: 5,
  windowMs: HOUR_MS,
  onError: "open",
});

/** Coarse limit on rejected attempts (invalid payloads, honeypot, stock conflicts): 20 / 15 min / IP. */
export const checkoutFailureLimiter = new DbRateLimiter({
  name: "checkout-failure",
  maxFailures: 20,
  windowMs: QUARTER_HOUR_MS,
  onError: "open",
});

/** Order tracking lookups: 10 per 15 minutes per IP (every lookup counts, hit or miss). */
export const trackingLimiter = new DbRateLimiter({
  name: "tracking",
  maxFailures: 10,
  windowMs: QUARTER_HOUR_MS,
  onError: "open",
});

/**
 * Customer confirmation emails: 2 per hour per email address. placeOrder accepts any typed
 * address, so without this an attacker could use the shop to mail-bomb someone.
 */
export const customerEmailLimiter = new DbRateLimiter({
  name: "customer-email",
  maxFailures: 2,
  windowMs: HOUR_MS,
  onError: "open",
});
