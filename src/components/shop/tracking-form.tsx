"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Check } from "lucide-react";
import { OrderLines, OrderTotals } from "@/components/shop/order-summary-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrackedOrder } from "@/lib/checkout-types";
import { t } from "@/lib/strings";
import { cn, format } from "@/lib/utils";
import { trackOrder } from "@/server/tracking";

const s = t.shop.tracking;

const STEPS = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;

export function TrackingForm({ initialNumber }: { initialNumber: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const input = {
      number: String(form.get("number") ?? ""),
      phone: String(form.get("phone") ?? ""),
    };
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await trackOrder(input);
        if (result.ok) setOrder(result.order);
        else {
          setOrder(null);
          setError(result.error);
        }
      } catch {
        setOrder(null);
        setError(s.unexpected);
      } finally {
        busy.current = false;
      }
    });
  }

  if (order) {
    return <TrackingResult order={order} onReset={() => setOrder(null)} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="number">{s.numberLabel}</Label>
        <Input
          id="number"
          name="number"
          defaultValue={initialNumber}
          placeholder={s.numberPlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          required
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{s.phoneLabel}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          required
          className="h-11 text-base"
        />
      </div>
      {error && (
        <p role="alert" data-testid="tracking-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
        {pending ? s.submitting : s.submit}
      </Button>
    </form>
  );
}

function TrackingResult({ order, onReset }: { order: TrackedOrder; onReset: () => void }) {
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const isTerminalOff = order.status === "CANCELLED" || order.status === "RETURNED";
  const date = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6" data-testid="tracking-result">
      <section className="space-y-3 rounded-xl border p-4">
        <p className="text-muted-foreground text-sm">
          {order.number} · {format(s.orderedOn, { date })}
        </p>
        <h2 className="text-lg font-semibold">{s.statusTitle}</h2>
        <p className="text-xl font-bold" data-testid="tracking-status">
          {s.status[order.status]}
        </p>
        <p className="text-muted-foreground text-sm">{s.statusHelp[order.status]}</p>

        {isTerminalOff ? null : (
          <ol aria-label={s.timeline} className="flex items-start pt-2">
            {STEPS.map((step, index) => {
              const done = index <= stepIndex;
              return (
                <li key={step} className="flex flex-1 flex-col items-center gap-1 text-center">
                  <div className="flex w-full items-center">
                    <span
                      className={cn(
                        "h-0.5 flex-1",
                        index === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-muted",
                      )}
                    />
                    <span
                      aria-current={index === stepIndex ? "step" : undefined}
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                        done
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background",
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "h-0.5 flex-1",
                        index === STEPS.length - 1
                          ? "bg-transparent"
                          : index < stepIndex
                            ? "bg-primary"
                            : "bg-muted",
                      )}
                    />
                  </div>
                  <span className={cn("text-xs", done ? "font-medium" : "text-muted-foreground")}>
                    {s.steps[step]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{s.items}</h2>
        <OrderLines items={order.items} />
      </section>

      <OrderTotals subtotal={order.subtotal} shippingFee={order.shippingFee} total={order.total} />

      <p className="text-muted-foreground text-sm">
        {s.governorate} : {order.governorate}
      </p>

      <Button variant="outline" size="lg" onClick={onReset} className="h-11 w-full text-base">
        {s.newSearch}
      </Button>
    </div>
  );
}
