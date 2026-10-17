import { describe, expect, it } from "vitest";
import {
  formatTunisDateTime,
  parseYmd,
  startOfNextTunisDay,
  startOfTunisDay,
  tunisDateString,
  tunisDayRange,
  tunisMonthRange,
} from "./tunis-time";

describe("tunis time", () => {
  it("a late-evening UTC instant is already the next day in Tunisia (UTC+1)", () => {
    expect(tunisDateString(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-17");
    expect(tunisDateString(new Date("2026-10-16T22:59:00Z"))).toBe("2026-10-16");
  });

  it("day range starts at 23:00 UTC the evening before", () => {
    const { start, end } = tunisDayRange(new Date("2026-10-16T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-15T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });

  it("month range handles December rollover", () => {
    const { start, end } = tunisMonthRange(new Date("2026-12-15T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("next day crosses month ends", () => {
    expect(startOfNextTunisDay("2026-02-28").toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(startOfNextTunisDay("2026-12-31").toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(startOfTunisDay("2027-01-01").toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("validates YYYY-MM-DD strictly", () => {
    expect(parseYmd("2026-02-28")).toBe("2026-02-28");
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("2026-2-3")).toBeNull();
    expect(parseYmd("abc")).toBeNull();
    expect(parseYmd(null)).toBeNull();
  });

  it("formats in Tunisian time", () => {
    expect(formatTunisDateTime(new Date("2026-10-16T13:03:00Z"))).toBe("16/10/2026 14:03");
  });
});
