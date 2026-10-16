import type { Metadata } from "next";

// Every /admin page (including the login page) is kept out of search engines.
// Do not add /admin routes to any sitemap.
export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
