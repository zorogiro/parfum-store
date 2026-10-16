import type { NextConfig } from "next";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: cloudName ? `/${cloudName}/image/upload/**` : "/**",
      },
      // Sample images created by `npm run db:seed` (dev data only).
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
    ],
  },
  /* config options here */
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/admin/:path*", headers: noindex },
      { source: "/checkout", headers: noindex },
      { source: "/suivi", headers: noindex },
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

export default nextConfig;
