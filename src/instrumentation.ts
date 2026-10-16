import { SENTRY_COMMON_OPTIONS } from "@/lib/sentry-scrub";

export async function register() {
  if (!process.env.AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with `npx auth secret` and add it to your environment.",
    );
  }

  // Optional error monitoring: without SENTRY_DSN nothing is loaded or sent.
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      ...SENTRY_COMMON_OPTIONS,
    });
  }
}

/** Reports server render / action / route errors (scrubbed in beforeSend). No-op without a DSN. */
export async function onRequestError(...args: [unknown, unknown, unknown]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...(args as Parameters<typeof Sentry.captureRequestError>));
}
