import { SENTRY_COMMON_OPTIONS } from "@/lib/sentry-scrub";

/**
 * Optional Sentry for the browser. Without NEXT_PUBLIC_SENTRY_DSN (inlined at build time) this
 * file does nothing and no Sentry code is shipped. Events go to our own /monitoring route (the
 * `tunnel` below, rewritten by withSentryConfig in next.config.ts), so the CSP needs no Sentry
 * origin. No personal data: see src/lib/sentry-scrub.ts.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tunnel: "/monitoring",
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      ...SENTRY_COMMON_OPTIONS,
    });
  });
}
