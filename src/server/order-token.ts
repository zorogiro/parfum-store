import { randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes = 256 bits, base64url (43 chars). Never derived from the order number. */
export function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time comparison of two tokens (false when the lengths differ). */
export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
