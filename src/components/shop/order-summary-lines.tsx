import type { OrderLineView } from "@/lib/checkout-types";
import { formatTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";

const s = t.shop.orderSummary;

/** Read-only order lines + totals, shared by the confirmation and tracking pages. */
export function OrderLines({ items }: { items: OrderLineView[] }) {
  return (
    <ul className="divide-y rounded-xl border">
      {items.map((item, index) => (
        <li key={index} className="flex items-start justify-between gap-3 p-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{item.productName}</p>
            <p className="text-muted-foreground">
              {item.variantLabel} · {format(s.quantity, { count: item.quantity })}
            </p>
          </div>
          <p className="shrink-0 font-medium">{formatTND(item.unitPrice * item.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({
  subtotal,
  shippingFee,
  total,
}: {
  subtotal: number;
  shippingFee: number;
  total: number;
}) {
  return (
    <dl className="space-y-2 rounded-xl border p-4 text-sm">
      <div className="flex justify-between gap-2">
        <dt>{s.subtotal}</dt>
        <dd>{formatTND(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>{s.shipping}</dt>
        <dd>{shippingFee === 0 ? s.free : formatTND(shippingFee)}</dd>
      </div>
      <div className="flex justify-between gap-2 border-t pt-2 text-base font-semibold">
        <dt>{s.total}</dt>
        <dd data-testid="order-total">{formatTND(total)}</dd>
      </div>
    </dl>
  );
}
