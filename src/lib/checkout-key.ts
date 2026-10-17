/**
 * Idempotency key of the current checkout attempt. It is created once and reused on every
 * retry (double click, network error, page reload), so the server never creates two orders for
 * the same attempt. Kept in sessionStorage so a reload keeps it; cleared after success or a
 * stock conflict (the cart changed, so the next attempt is a new one).
 */
const STORAGE_KEY = "parfum-store.checkout-key.v1";

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for insecure contexts (plain http on a LAN address): RFC 4122 v4 from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCheckoutKey(): string {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && UUID.test(saved)) return saved;
    const fresh = randomUuid();
    sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return randomUuid(); // storage blocked: still unique per call site (kept in a ref by the caller)
  }
}

export function clearCheckoutKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
