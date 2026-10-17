import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { OrderLines, OrderTotals } from "@/components/shop/order-summary-lines";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/strings";
import { findOrderForConfirmation } from "@/server/order-lookup";

const s = t.shop.confirmation;

export const metadata: Metadata = {
  title: s.metaTitle,
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Personal data: read per request (searchParams), never cached or shared. A wrong number or
 * token is answered with a real 404 by src/proxy.ts; notFound() here is only the fallback.
 */
async function ConfirmationContent({ searchParams }: PageProps<"/order/confirmation">) {
  const raw = await searchParams;
  const order = await findOrderForConfirmation(first(raw.number), first(raw.token));
  if (!order) notFound();

  const trackHref = `/suivi?number=${encodeURIComponent(order.number)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <CircleCheck className="size-12 text-green-600" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-muted-foreground text-sm">{s.numberLabel}</p>
        <p className="text-2xl font-bold tracking-wide" data-testid="order-number">
          {order.number}
        </p>
      </header>

      <p className="bg-muted rounded-xl p-4 text-sm" data-testid="call-message">
        {s.callMessage}
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">{s.items}</h2>
        <OrderLines items={order.items} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{s.totals}</h2>
        <OrderTotals
          subtotal={order.subtotal}
          shippingFee={order.shippingFee}
          total={order.total}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{s.delivery}</h2>
        <dl className="space-y-1 rounded-xl border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{s.deliveryTo}</dt>
            <dd>
              {order.customerName}
              <br />
              {order.address}
              <br />
              {order.city}, {order.governorate}
            </dd>
          </div>
          <div className="pt-2">
            <dt className="text-muted-foreground">{s.phone}</dt>
            <dd dir="ltr">{order.phone}</dd>
          </div>
          {order.notes && (
            <div className="pt-2">
              <dt className="text-muted-foreground">{s.notes}</dt>
              <dd className="whitespace-pre-line">{order.notes}</dd>
            </div>
          )}
          <div className="pt-2">
            <dt className="text-muted-foreground">{s.payment}</dt>
            <dd>{s.paymentValue}</dd>
          </div>
        </dl>
      </section>

      <p className="text-muted-foreground text-center text-xs">{s.keepNumber}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={trackHref}
          className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}
        >
          {s.track}
        </Link>
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-11 px-5 text-base",
          })}
        >
          {s.continueShopping}
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage(props: PageProps<"/order/confirmation">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="mx-auto max-w-2xl space-y-4">
          <div className="bg-muted mx-auto h-12 w-12 animate-pulse rounded-full" />
          <div className="bg-muted mx-auto h-8 w-2/3 animate-pulse rounded" />
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
        </div>
      }
    >
      <ConfirmationContent {...props} />
    </Suspense>
  );
}
