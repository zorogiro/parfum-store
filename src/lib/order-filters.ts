/**
 * URL filters of the admin order list (and of the CSV export, which honours the same ones).
 * Everything coming from the URL is whitelisted here. No React imports.
 *   status=PENDING,CONFIRMED (or repeated)  q=free text  from/to=YYYY-MM-DD  page=N
 */
import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatusValue } from "@/lib/order-status";
import { parseYmd, startOfNextTunisDay, startOfTunisDay } from "@/lib/tunis-time";

export const ORDERS_PAGE_SIZE = 20;
export const MAX_SEARCH_LENGTH = 100;

export type OrderFilters = {
  statuses: OrderStatusValue[];
  q: string;
  from: string | null;
  to: string | null;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function all(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : [value ?? ""]).flatMap((v) => v.split(","));
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseOrderFilters(params: RawParams): OrderFilters {
  const statuses = ORDER_STATUSES.filter((s) => all(params.status).some((v) => v.trim() === s));
  return {
    statuses,
    q: first(params.q).slice(0, MAX_SEARCH_LENGTH),
    from: parseYmd(first(params.from)),
    to: parseYmd(first(params.to)),
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

/** Same filters from a URLSearchParams (route handler). */
export function parseOrderFiltersFromSearchParams(search: URLSearchParams): OrderFilters {
  const params: RawParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  return parseOrderFilters(params);
}

/**
 * Digits to look for in the stored phone ("+216XXXXXXXX") when the search text looks like a phone
 * number: "22 123 456", "+216 22 123 456", "0021622123456" and "22123456" all give "22123456".
 * Returns null when the text is not phone-like or has fewer than 3 digits.
 */
export function phoneSearchDigits(q: string): string | null {
  if (!/^[\d\s+().-]+$/.test(q)) return null;
  let digits = q.replace(/\D/g, "");
  if (digits.startsWith("00216")) digits = digits.slice(5);
  else if (digits.startsWith("216") && digits.length >= 9) digits = digits.slice(3);
  return digits.length >= 3 ? digits : null;
}

export function buildOrderWhere(
  filters: OrderFilters,
  options: { ignoreStatus?: boolean } = {},
): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];

  if (!options.ignoreStatus && filters.statuses.length > 0) {
    and.push({ status: { in: filters.statuses } });
  }

  const q = filters.q.trim();
  if (q) {
    const or: Prisma.OrderWhereInput[] = [
      { number: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
    ];
    const digits = phoneSearchDigits(q);
    if (digits) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }

  if (filters.from || filters.to) {
    and.push({
      createdAt: {
        ...(filters.from && { gte: startOfTunisDay(filters.from) }),
        ...(filters.to && { lt: startOfNextTunisDay(filters.to) }),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/** Link to the list with some filters replaced (page resets unless given). */
export function buildOrdersHref(
  filters: OrderFilters,
  overrides: Partial<OrderFilters> = {},
  base = "/admin/orders",
): string {
  const next = { ...filters, page: 1, ...overrides };
  const search = new URLSearchParams();
  if (next.statuses.length > 0) search.set("status", next.statuses.join(","));
  if (next.q) search.set("q", next.q);
  if (next.from) search.set("from", next.from);
  if (next.to) search.set("to", next.to);
  if (next.page > 1) search.set("page", String(next.page));
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
