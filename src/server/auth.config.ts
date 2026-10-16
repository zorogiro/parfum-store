import type { NextAuthConfig } from "next-auth";

const isProd = process.env.NODE_ENV === "production";

/**
 * Edge-safe Auth.js config (no database or bcrypt imports) shared by the proxy
 * and the full config in `auth.ts`. Providers are added in `auth.ts`.
 */
export const authConfig = {
  providers: [],
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  useSecureCookies: isProd,
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.adminId = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.adminId === "string") session.user.id = token.adminId;
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
} satisfies NextAuthConfig;
