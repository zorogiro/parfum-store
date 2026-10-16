import { db } from "@/lib/db";
import { tunisDayRange, tunisMonthRange } from "@/lib/tunis-time";
import { requireAdmin } from "@/server/auth";

/** Dashboard statistics: aggregate queries only, no order is loaded into memory. */

export const LOW_STOCK_THRESHOLD = 3;
const LOW_STOCK_LIMIT = 20;

export async function getDashboardStats(now: Date = new Date()) {
  await requireAdmin();
  const day = tunisDayRange(now);
  const month = tunisMonthRange(now);

  const ordersToday = await db.order.count({
    where: { createdAt: { gte: day.start, lt: day.end } },
  });
  const pending = await db.order.count({ where: { status: "PENDING" } });

  // Revenue by month of DELIVERY: the history row of the transition to DELIVERED. DELIVERED is
  // final, so an order has at most one such row.
  const revenueRows = await db.$queryRaw<{ revenue: bigint | null }[]>`
    SELECT COALESCE(SUM(o."total"), 0)::bigint AS "revenue"
    FROM "Order" o
    JOIN "OrderStatusHistory" h ON h."orderId" = o."id"
    WHERE o."status" = 'DELIVERED'
      AND h."toStatus" = 'DELIVERED'
      AND h."changedAt" >= ${month.start}
      AND h."changedAt" < ${month.end}`;
  const revenue = Number(revenueRows[0]?.revenue ?? 0);

  const lowStock = await db.variant.findMany({
    where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { isActive: true } },
    orderBy: [{ stock: "asc" }, { sku: "asc" }],
    take: LOW_STOCK_LIMIT,
    select: {
      id: true,
      label: true,
      sku: true,
      stock: true,
      product: { select: { id: true, name: true } },
    },
  });

  return { ordersToday, pending, revenue, lowStock };
}
