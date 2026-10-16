import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { formatTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { formatTunisDateTime } from "@/lib/tunis-time";
import { requireAdmin } from "@/server/auth";
import { getOrderDetail } from "@/server/orders-queries";

const s = t.admin.orders.print;

export const metadata = { title: s.title };

export default async function Page({ params }: PageProps<"/admin/orders/[id]/print">) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-[148mm] p-4 text-sm print:max-w-none print:p-0">
      {/* A5 portrait fits one delivery slip; A4 printers scale it without changes. */}
      <style>{`@page { size: A5; margin: 10mm; }`}</style>

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-lg font-semibold">{s.title}</h1>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <p className="text-base font-bold">{t.site.name}</p>
          <p className="text-xs uppercase">{s.title}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">
            {s.order} {order.number}
          </p>
          <p className="text-xs">
            {s.date} : {formatTunisDateTime(order.createdAt)}
          </p>
        </div>
      </header>

      <section className="mt-3 space-y-1">
        <p>
          <span className="font-semibold">{s.customer} :</span> {order.customerName}
        </p>
        <p>
          <span className="font-semibold">{s.phone} :</span> <span dir="ltr">{order.phone}</span>
        </p>
        <p>
          <span className="font-semibold">{s.address} :</span> {order.address}, {order.city},{" "}
          {order.governorate}
        </p>
        {order.notes && (
          <p className="break-words whitespace-pre-line">
            <span className="font-semibold">{s.notes} :</span> {order.notes}
          </p>
        )}
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1 pr-2 font-semibold">{s.item}</th>
            <th className="px-2 py-1 text-right font-semibold">{s.unitPrice}</th>
            <th className="px-2 py-1 text-right font-semibold">{s.quantity}</th>
            <th className="py-1 pl-2 text-right font-semibold">{s.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-gray-400 align-top">
              <td className="py-1 pr-2">
                {item.productName}
                <span className="block text-xs text-gray-700">{item.variantLabel}</span>
              </td>
              <td className="px-2 py-1 text-right whitespace-nowrap">
                {formatTND(item.unitPrice)}
              </td>
              <td className="px-2 py-1 text-right">{item.quantity}</td>
              <td className="py-1 pl-2 text-right whitespace-nowrap">
                {formatTND(item.unitPrice * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-2 ml-auto w-3/4 space-y-0.5">
        <div className="flex justify-between">
          <dt>{s.subtotal}</dt>
          <dd>{formatTND(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{s.shipping}</dt>
          <dd>{order.shippingFee === 0 ? s.free : formatTND(order.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
          <dt>{s.toCollect}</dt>
          <dd>{formatTND(order.total)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-center text-xs">{s.cashOnDelivery}</p>
    </main>
  );
}
