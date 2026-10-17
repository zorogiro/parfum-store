import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  allowedTransitions,
  canTransition,
  isFinalStatus,
  restoresStock,
} from "./order-status";

const ALLOWED = new Set([
  "PENDING>CONFIRMED",
  "PENDING>CANCELLED",
  "CONFIRMED>SHIPPED",
  "CONFIRMED>CANCELLED",
  "SHIPPED>DELIVERED",
  "SHIPPED>RETURNED",
]);

describe("canTransition", () => {
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      const expected = ALLOWED.has(`${from}>${to}`);
      it(`${from} -> ${to} is ${expected ? "allowed" : "forbidden"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("allowedTransitions", () => {
  it("lists exactly the allowed targets", () => {
    expect(allowedTransitions("PENDING")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(allowedTransitions("CONFIRMED")).toEqual(["SHIPPED", "CANCELLED"]);
    expect(allowedTransitions("SHIPPED")).toEqual(["DELIVERED", "RETURNED"]);
  });

  it("DELIVERED, CANCELLED and RETURNED are final", () => {
    for (const status of ["DELIVERED", "CANCELLED", "RETURNED"] as const) {
      expect(allowedTransitions(status)).toEqual([]);
      expect(isFinalStatus(status)).toBe(true);
    }
    expect(isFinalStatus("PENDING")).toBe(false);
  });

  it("agrees with canTransition", () => {
    for (const from of ORDER_STATUSES) {
      expect([...allowedTransitions(from)].sort()).toEqual(
        ORDER_STATUSES.filter((to) => canTransition(from, to)).sort(),
      );
    }
  });
});

describe("restoresStock", () => {
  it("only for CANCELLED and RETURNED", () => {
    expect(ORDER_STATUSES.filter(restoresStock)).toEqual(["CANCELLED", "RETURNED"]);
  });

  it("every restoring status is final, so stock can only be restored once", () => {
    for (const status of ORDER_STATUSES.filter(restoresStock)) {
      expect(isFinalStatus(status)).toBe(true);
    }
  });
});

describe("labels and badges", () => {
  it("has a French label and a colour for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(STATUS_BADGE_CLASSES[status].length).toBeGreaterThan(0);
    }
  });
});
