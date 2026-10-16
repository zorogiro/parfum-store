import { toCsv } from "@/lib/csv";
import { toTNDInputValue } from "@/lib/money";
import { parseOrderFiltersFromSearchParams } from "@/lib/order-filters";
import { STATUS_LABELS, isOrderStatus } from "@/lib/order-status";
import { t } from "@/lib/strings";
import { tunisDateString, formatTunisDateTime } from "@/lib/tunis-time";
import { requireAdmin } from "@/server/auth";
import { getOrdersForExport } from "@/server/orders-queries";

/** CSV export of the orders matching the same URL filters as the list (5 000 rows maximum). */
export async function GET(request: Request) {
  // First statement: the proxy is not enough on its own.
  await requireAdmin();

  const filters = parseOrderFiltersFromSearchParams(new URL(request.url).searchParams);
  const orders = await getOrdersForExport(filters);

  const rows = orders.map((o) => [
    o.number,
    formatTunisDateTime(o.createdAt),
    isOrderStatus(o.status) ? STATUS_LABELS[o.status] : o.status,
    o.customerName,
    o.phone,
    o.governorate,
    o.city,
    o.address,
    o.items.map((i) => `${i.quantity} × ${i.productName} (${i.variantLabel})`).join(" | "),
    toTNDInputValue(o.subtotal),
    toTNDInputValue(o.shippingFee),
    toTNDInputValue(o.total),
    o.notes ?? "",
  ]);

  return new Response(toCsv(t.admin.orders.csv.header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-${tunisDateString(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
