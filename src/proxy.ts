import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/server/auth.config";
import { catalogSlugExists } from "@/server/catalog-slugs";
import { confirmationLinkIsValid } from "@/server/order-lookup";

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

  // Order confirmation: a wrong or missing number/token gets a real HTTP 404 (same page as an
  // unknown product, so nothing leaks). A valid link is never cached or shared.
  if (pathname === "/order/confirmation") {
    const valid = await confirmationLinkIsValid(
      req.nextUrl.searchParams.get("number"),
      req.nextUrl.searchParams.get("token"),
    );
    if (!valid) {
      const res = NextResponse.rewrite(new URL("/introuvable", req.url));
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/p/:slug", "/c/:slug", "/order/confirmation"],
};
