/**
 * Browser-side error reporting. A no-op unless NEXT_PUBLIC_SENTRY_DSN was set at build time: then
 * the whole branch (and the Sentry SDK chunk) is removed from the bundle. Used by the error
 * boundaries, which swallow errors before the SDK's global handlers can see them.
 */
export function reportClientError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
