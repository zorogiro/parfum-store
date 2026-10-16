import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. On Vercel `x-forwarded-for` is set by the platform
 * (client address first), so it can be trusted there. Behind another proxy this header can be
 * spoofed, which only weakens the rate limit; it never affects order correctness.
 * Returns "unknown" when no header is present (local development).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || h.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}
