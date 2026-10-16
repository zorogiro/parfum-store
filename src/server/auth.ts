import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loginRateLimiter } from "./rate-limiters";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "./auth.config";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the email is unknown so both failure paths cost a bcrypt round.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

/**
 * Best-effort client IP. x-forwarded-for is only trustworthy behind a proxy
 * that overwrites it (e.g. Vercel); elsewhere it can be spoofed.
 */
function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const key = `${clientIp(request)}|${email}`;
        if (await loginRateLimiter.isBlocked(key)) throw new RateLimitedError();

        const admin = await db.adminUser.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

        if (!admin || !valid) {
          await loginRateLimiter.recordFailure(key);
          return null;
        }

        await loginRateLimiter.reset(key);
        return { id: admin.id, email: admin.email };
      },
    }),
  ],
});

/**
 * Verifies the admin session. Call it at the top of EVERY admin server action
 * and route handler: the proxy alone is not enough. Redirects to the login page
 * when there is no valid session, or when the admin no longer exists.
 */
export async function requireAdmin() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/admin/login");

  const admin = await db.adminUser.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!admin) redirect("/admin/login");
  return admin;
}
