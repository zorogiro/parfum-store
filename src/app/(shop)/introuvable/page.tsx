import { notFound } from "next/navigation";

/**
 * Target of the proxy rewrite for unknown /p/[slug] and /c/[slug] URLs (see src/proxy.ts).
 * Prerendered once; calling notFound() makes it respond with HTTP 404 and the shop 404 page.
 */
export default function MissingPage() {
  notFound();
}
