import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon, MessageCircle, Phone, Printer } from "lucide-react";
import { OrderAdminNote } from "@/components/admin/order-admin-note";
import { OrderStatusPanel } from "@/components/admin/order-status-panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatTND } from "@/lib/money";
import { telHref, whatsappHref } from "@/lib/order-links";
import { STATUS_LABELS, allowedTransitions } from "@/lib/order-status";
import { t } from "@/lib/strings";
import { formatTunisDateTime } from "@/lib/tunis-time";
import { format } from "@/lib/utils";
import { requireAdmin } from "@/server/auth";
import { getOrderDetail } from "@/server/orders-queries";

const s = t.admin.orders;

export const metadata = { title: s.title };

export default async function Page({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const message = format(s.customer.whatsappMessage, {
    name: order.customerName,
    number: order.number,
  });

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-muted-foreground text-sm hover:underline">
        ← {s.back}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {format(s.detailTitle, { number: order.number })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {format(s.items.orderedOn, { date: formatTunisDateTime(order.createdAt) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <Link
            href={`/admin/orders/${order.id}/print`}
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Printer />
            {s.print.open}
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">{s.customer.title}</h2>
            <p className="text-lg font-medium">{order.customerName}</p>
            <div className="flex flex-wrap gap-2">
              <a href={telHref(order.phone)} className={buttonVariants({ variant: "outline" })}>
                <Phone />
                <span dir="ltr">{order.phone}</span>
              </a>
              <a
                href={whatsappHref(order.phone, message)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <MessageCircle />
                {s.customer.whatsapp}
              </a>
            </div>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              {order.email && (
                <>
                  <dt className="text-muted-foreground">{s.customer.email}</dt>
                  <dd className="break-all">{order.email}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{s.customer.address}</dt>
              <dd>
                {order.address}
                <br />
                {order.city}, {order.governorate}
              </dd>
              <dt className="text-muted-foreground">{s.customer.notes}</dt>
              <dd className="break-words whitespace-pre-line">{order.notes || s.customer.none}</dd>
            </dl>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">{s.items.title}</h2>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-md">
                      <ImageIcon className="size-5" aria-label={s.items.noImage} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.productName}</p>
                    <p className="text-muted-foreground text-sm">
                      {item.variantLabel} · {formatTND(item.unitPrice)} ×{" "}
                      {format(s.items.quantity, { count: item.quantity })}
                    </p>
                  </div>
                  <p className="text-right font-medium whitespace-nowrap">
                    {formatTND(item.unitPrice * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{s.items.subtotal}</dt>
                <dd>{formatTND(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{s.items.shipping}</dt>
                <dd>{order.shippingFee === 0 ? s.items.free : formatTND(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>{s.items.total}</dt>
                <dd>{formatTND(order.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">{s.statusPanel.title}</h2>
            <p className="text-sm">
              <span className="text-muted-foreground">{s.statusPanel.current} : </span>
              <strong>{STATUS_LABELS[order.status]}</strong>
            </p>
            <OrderStatusPanel
              orderId={order.id}
              number={order.number}
              status={order.status}
              allowed={[...allowedTransitions(order.status)]}
            />
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">{s.history.title}</h2>
            {order.statusHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">{s.history.empty}</p>
            ) : (
              <ol className="space-y-3 border-l pl-4">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="bg-foreground absolute top-1.5 -left-[1.3rem] size-2 rounded-full" />
                    <p className="font-medium">
                      {h.fromStatus
                        ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`
                        : s.history.created}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatTunisDateTime(h.changedAt)} ·{" "}
                      {format(s.history.by, {
                        who: h.changedBy === "system" ? s.history.system : h.changedBy,
                      })}
                    </p>
                    {h.note && <p className="mt-1 break-words whitespace-pre-line">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <OrderAdminNote orderId={order.id} initial={order.adminNote ?? ""} />
          </section>
        </div>
      </div>
    </div>
  );
}
