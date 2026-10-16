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
