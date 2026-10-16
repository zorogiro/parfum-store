/**
 * Prices are stored and handled as integers in millimes (1 TND = 1000 millimes).
 * Never use floats for money.
 */

const MILLIMES_PER_TND = 1000;

// Intl output varies between ICU builds (narrow/regular NBSP as group separator),
// so we format the digits ourselves to get a stable "45,500 TND".
export function formatTND(millimes: number): string {
  if (!Number.isInteger(millimes)) {
    throw new Error(`formatTND expects an integer amount of millimes, got ${millimes}`);
  }
  const sign = millimes < 0 ? "-" : "";
  const abs = Math.abs(millimes);
  const dinars = Math.floor(abs / MILLIMES_PER_TND);
  const rest = String(abs % MILLIMES_PER_TND).padStart(3, "0");
  const grouped = String(dinars).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${rest} TND`;
}

const MAX_INTEGER_DIGITS = 12;

/**
 * Parses an amount typed by an admin in TND into integer millimes.
 * Accepts "45", "45.5", "45.500", "45,500" (comma = decimal separator, as in French)
 * and numbers. Anything beyond 3 decimals is rounded half-up to the nearest millime.
 * Returns null for anything that is not a plain non-negative decimal
 * (negatives, thousands separators like "1,234.567", letters, empty).
 */
export function parseTND(input: string | number): number | null {
  const raw = typeof input === "number" ? (Number.isFinite(input) ? String(input) : "") : input;
  const cleaned = raw
    .replace(/[\s  ]/g, "")
    .replace(/(tnd|dt)$/i, "")
    .replace(",", ".");

  const match = /^(\d+)?(?:\.(\d+))?$/.exec(cleaned);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;

  const whole = (match[1] ?? "0").replace(/^0+(?=\d)/, "");
  if (whole.length > MAX_INTEGER_DIGITS) return null;

  const decimals = match[2] ?? "";
  let millimes = Number(whole) * MILLIMES_PER_TND + Number(decimals.slice(0, 3).padEnd(3, "0"));
  if (decimals.length > 3 && decimals[3] >= "5") millimes += 1;

  return Number.isSafeInteger(millimes) ? millimes : null;
}

/** Millimes as an editable TND string for form inputs, e.g. 45500 -> "45.500". */
export function toTNDInputValue(millimes: number): string {
  if (!Number.isInteger(millimes) || millimes < 0) {
    throw new Error(`toTNDInputValue expects a non-negative integer, got ${millimes}`);
  }
  return `${Math.floor(millimes / MILLIMES_PER_TND)}.${String(millimes % MILLIMES_PER_TND).padStart(3, "0")}`;
}
