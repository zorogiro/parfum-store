/**
 * Tunisian phone numbers: 8 national digits, the first one in 2, 3, 4, 5, 7 or 9.
 * Accepted inputs (spaces, dots and dashes are ignored): "+216 22 123 456", "00216...",
 * "216..." (11 digits) and "22123456". Everything else is rejected.
 * No React or DB imports: shared by the checkout form, the Zod schema and the tracking lookup.
 */

const NATIONAL_PATTERN = /^[234579]\d{7}$/;

/** Returns "+216XXXXXXXX", or null when the input is not a valid Tunisian number. */
export function normalizeTunisianPhone(input: string): string | null {
  const compact = input.replace(/[\s.\-]/g, "");
  if (compact === "") return null;

  let digits: string;
  if (compact.startsWith("+216")) digits = compact.slice(4);
  else if (compact.startsWith("00216")) digits = compact.slice(5);
  else if (compact.startsWith("216") && compact.length === 11) digits = compact.slice(3);
  else digits = compact;

  // Rejects letters, a stray "+" or a second prefix, wrong lengths and invalid first digits.
  return NATIONAL_PATTERN.test(digits) ? `+216${digits}` : null;
}
