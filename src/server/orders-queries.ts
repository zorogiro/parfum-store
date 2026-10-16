import { db } from "@/lib/db";
import { ORDERS_PAGE_SIZE, buildOrderWhere, type OrderFilters } from "@/lib/order-filters";
import { ORDER_STATUSES, isOrderStatus, type OrderStatusValue } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth";

/** Read queries of the admin order pages. Plain module (not a server action file). */

export const EXPORT_MAX_ROWS = 5000;

function asStatus(value: string): OrderStatusValue {
  if (!isOrderStatus(value)) throw new Error("Unexpected order status in database");
  return value;
}

export async function getOrderList(filters: OrderFilters) {
  await requireAdmin();
  const where = buildOrderWhere(filters);
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const orders = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      createdAt: true,
      customerName: true,
      governorate: true,
      total: true,
      status: true,
    },
  });
  return {
    total,
    page,
    pageCount,
    orders: orders.map((o) => ({ ...o, status: asStatus(o.status) })),
  };
}

/** Counts per status for the tabs: every filter applies except the status itself. */
export async function getStatusCounts(filters: OrderFilters) {
  await requireAdmin();
  const grouped = await db.order.groupBy({
    by: ["status"],
    where: buildOrderWhere(filters, { ignoreStatus: true }),
    _count: { _all: true },
  });
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatusValue,
    number
  >;
  let all = 0;
  for (const row of grouped) {
    counts[asStatus(row.status)] = row._count._all;
    all += row._count._all;
  }
  return { all, counts };
}

/**
 * One order with everything the detail and print pages need. The trackingToken is deliberately
 * NOT selected: it must never reach the admin UI.
 */
export async function getOrderDetail(id: string) {
  await requireAdmin();
  const order = await db.order.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      customerName: true,
      phone: true,
      email: true,
      governorate: true,
      city: true,
      address: true,
      notes: true,
      adminNote: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      items: {
        orderBy: { productName: "asc" },
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          unitPrice: true,
          quantity: true,
          variant: {
            select: {
              product: {
                select: {
                  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                },
              },
            },
          },
        },
      },
      statusHistory: {
        orderBy: [{ changedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          changedAt: true,
          changedBy: true,
          note: true,
        },
      },
    },
  });
  if (!order) return null;
  return {
    ...order,
    status: asStatus(order.status),
    items: order.items.map(({ variant, ...item }) => ({
      ...item,
      imageUrl: variant.product.images[0]?.url ?? null,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      ...h,
      fromStatus: h.fromStatus ? asStatus(h.fromStatus) : null,
      toStatus: asStatus(h.toStatus),
    })),
  };
}

export async function getOrdersForExport(filters: OrderFilters) {
  await requireAdmin();
  return db.order.findMany({
    where: buildOrderWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_MAX_ROWS,
    select: {
      number: true,
      createdAt: true,
      status: true,
      customerName: true,
      phone: true,
      governorate: true,
      city: true,
      address: true,
      notes: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      items: {
        orderBy: { productName: "asc" },
        select: { productName: true, variantLabel: true, quantity: true },
      },
    },
  });
}
