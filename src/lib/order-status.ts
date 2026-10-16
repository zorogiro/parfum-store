/**
 * Order status workflow. Pure module (no React/DB imports): shared by the server action that
 * enforces it, the admin UI that shows only the allowed buttons, and the tests.
 *   PENDING -> CONFIRMED | CANCELLED
 *   CONFIRMED -> SHIPPED | CANCELLED
 *   SHIPPED -> DELIVERED | RETURNED
 * DELIVERED, CANCELLED and RETURNED are final.
 */
import { t } from "@/lib/strings";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function allowedTransitions(from: OrderStatusValue): readonly OrderStatusValue[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: OrderStatusValue): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Moving INTO one of these statuses puts the items back in stock (reachable only once). */
export function restoresStock(to: OrderStatusValue): boolean {
  return to === "CANCELLED" || to === "RETURNED";
}

export const STATUS_LABELS: Record<OrderStatusValue, string> = t.admin.orders.status;

/** Semantic badge palette (Tailwind classes, light and dark). */
export const STATUS_BADGE_CLASSES: Record<OrderStatusValue, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200",
  SHIPPED: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  DELIVERED: "bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
  RETURNED: "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200",
};
