import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  const isLogin = pathname === "/admin/login";

  if (isLogin && isLoggedIn) return NextResponse.redirect(new URL("/admin", req.nextUrl));
  if (!isLogin && !isLoggedIn) return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
});

export const config = { matcher: ["/admin", "/admin/:path*"] };
