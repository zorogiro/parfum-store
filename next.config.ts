import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const isDev = process.env.NODE_ENV === "development";
// placehold.co only hosts the sample images of `npm run db:seed` (dev data). The production
// seed creates no images, so the Vercel Production environment does not allow it.
const allowPlaceholderImages = process.env.VERCEL_ENV !== "production";

/**
 * Content-Security-Policy, enforced on every page.
 *
 * It is static (no per-request nonce): nonces need dynamic rendering, which would defeat the
 * prerendered shells of Cache Components. So `script-src` keeps 'unsafe-inline' (Next.js inlines
 * its bootstrap / flight-data scripts and the JSON-LD block); everything else is locked down:
 * no third-party scripts, no objects, no framing, forms only to ourselves.
 * - img-src: our own origin (next/image proxies through /_next/image), Cloudinary (admin
 *   previews after an upload, direct URLs), placehold.co (seed data only), data:/blob: (previews).
 * - connect-src: the browser uploads product images straight to the Cloudinary API.
 * - 'unsafe-eval' only in `next dev` (React debugging), never in production.
 * If you add a third-party script (analytics, Sentry browser SDK), allow its origin here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://res.cloudinary.com${allowPlaceholderImages ? " https://placehold.co" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://api.cloudinary.com${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Legacy equivalent of frame-ancestors, for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Ignored over plain http (local dev); in production the site must be served over https only.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: cloudName ? `/${cloudName}/image/upload/**` : "/**",
      },
      // Sample images created by `npm run db:seed` (dev data only, not allowed in production).
      ...(allowPlaceholderImages
        ? [{ protocol: "https" as const, hostname: "placehold.co", pathname: "/**" }]
        : []),
    ],
  },
  /* config options here */
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/admin/:path*", headers: noindex },
      { source: "/checkout", headers: noindex },
      { source: "/suivi", headers: noindex },
      { source: "/cart", headers: noindex },
      { source: "/search", headers: noindex },
      // Personal data: never cached by the browser, a CDN or a shared proxy.
      {
        source: "/order/:path*",
        headers: [...noindex, { key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/**
 * Sentry is optional: only when a DSN is set at build time is the config wrapped (which adds the
 * /monitoring tunnel rewrite). Source maps are uploaded only if SENTRY_AUTH_TOKEN, SENTRY_ORG and
 * SENTRY_PROJECT are set. Browser events go through /monitoring, so the CSP needs no Sentry origin.
 */
const sentryEnabled = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      tunnelRoute: "/monitoring",
      widenClientFileUpload: false,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : nextConfig;
