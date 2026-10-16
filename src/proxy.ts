import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/server/auth.config";
import { catalogSlugExists } from "@/server/catalog-slugs";

const { auth } = NextAuth(authConfig);

const adminProxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const isLogin = pathname === "/admin/login";

  if (isLogin && isLoggedIn) return NextResponse.redirect(new URL("/admin", req.nextUrl));
  if (!isLogin && !isLoggedIn) return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
});

const CATALOG_ROUTE = /^\/(p|c)\/([^/]+)\/?$/;

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return adminProxy(req, event as never);
  }

  // Unknown or inactive product / category slugs: real HTTP 404 before the page streams.
  // `/introuvable` is a prerendered page that calls notFound(), so it is served with status 404.
  const match = CATALOG_ROUTE.exec(pathname);
  if (match) {
    let slug = match[2];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // malformed escape: the slug check below rejects it
    }
    const exists = await catalogSlugExists(match[1] === "p" ? "product" : "category", slug);
    if (!exists) return NextResponse.rewrite(new URL("/introuvable", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/p/:slug", "/c/:slug"] };
