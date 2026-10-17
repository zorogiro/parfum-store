/**
 * Day and month boundaries in Africa/Tunis. Tunisia has had no daylight saving time since 2009
 * (fixed UTC+1), so boundaries are built with a constant offset; formatting uses Intl with the
 * zone name. Pure module.
 */

export const TUNIS_TIMEZONE = "Africa/Tunis";
const TUNIS_OFFSET = "+01:00";

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" of an instant, as seen in Tunisia. */
export function tunisDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TUNIS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Validates a "YYYY-MM-DD" string (real calendar date); returns it or null. */
export function parseYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = YMD_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const valid =
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return valid ? value : null;
}

/** First instant of a Tunisian calendar day. */
export function startOfTunisDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${TUNIS_OFFSET}`);
}

/** First instant of the day after a Tunisian calendar day (exclusive upper bound). */
export function startOfNextTunisDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return startOfTunisDay(next.toISOString().slice(0, 10));
}

/** [start, end) of the current Tunisian day. */
export function tunisDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const ymd = tunisDateString(now);
  return { start: startOfTunisDay(ymd), end: startOfNextTunisDay(ymd) };
}

/** [start, end) of the current Tunisian month. */
export function tunisMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const [y, m] = tunisDateString(now).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return {
    start: startOfTunisDay(`${y}-${pad(m)}-01`),
    end: startOfTunisDay(`${nextY}-${pad(nextM)}-01`),
  };
}

/** "16/10/2026 14:03" in Tunisian time. */
export function formatTunisDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TUNIS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
