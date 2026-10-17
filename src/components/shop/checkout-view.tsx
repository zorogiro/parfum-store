"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { effectiveQuantity, type CartDetails, type CartLineDetail } from "@/lib/cart-details";
import { clearCheckoutKey, getCheckoutKey } from "@/lib/checkout-key";
import { formatTND } from "@/lib/money";
import { amountToFreeShipping, calculateSubtotal, calculateTotal } from "@/lib/pricing";
import { t } from "@/lib/strings";
import { cn, format } from "@/lib/utils";
import { checkoutSchema, toFieldErrors } from "@/lib/validators/checkout";
import { getCartDetails } from "@/server/cart";
import { placeOrder } from "@/server/checkout";
import type { ShippingZoneOption } from "@/server/storefront";
import { useCart } from "./cart-provider";

const s = t.shop.checkout;
const f = s.fields;

type Values = {
  customerName: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
};

const EMPTY: Values = {
  customerName: "",
  phone: "",
  email: "",
  governorate: "",
  city: "",
  address: "",
  notes: "",
};

const FIELD_ORDER = [
  "customerName",
  "phone",
  "email",
  "governorate",
  "city",
  "address",
  "notes",
] as const;

const selectClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-11 w-full min-w-0 rounded-lg border px-2.5 text-base outline-none focus-visible:ring-3 dark:bg-input/30";

type Fetched = { data: CartDetails | null; failed: boolean };

export function CheckoutView({ zones }: { zones: ShippingZoneOption[] }) {
  const router = useRouter();
  const { items, isHydrated, setQuantity, clear } = useCart();

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [fetched, setFetched] = useState<Fetched>({ data: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  /** variantId -> notice shown when the quantity was lowered to the stock available. */
  const [adjusted, setAdjusted] = useState<Record<string, string>>({});

  const submittingRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const idsKey = useMemo(
    () =>
      items
        .map((i) => i.variantId)
        .sort()
        .join(","),
    [items],
  );

  // Fresh prices and stock from the server. Re-fetched only when the set of variants changes.
  useEffect(() => {
    if (!isHydrated || idsKey === "") return;
    let cancelled = false;
    getCartDetails(itemsRef.current).then(
      (result) => {
        if (cancelled) return;
        setFetched((prev) =>
          result.ok ? { data: result, failed: false } : { data: prev.data, failed: true },
        );
      },
      () => {
        if (!cancelled) setFetched((prev) => ({ data: prev.data, failed: true }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isHydrated, idsKey, attempt]);

  const detailsById = useMemo(
    () => new Map(fetched.data?.lines.map((l) => [l.variantId, l]) ?? []),
    [fetched.data],
  );

  if (redirecting) {
    return (
      <p role="status" className="text-muted-foreground py-16 text-center">
        {s.redirecting}
      </p>
    );
  }
  if (!isHydrated) return <CheckoutSkeleton />;
  if (items.length === 0) return <CheckoutEmpty />;

  const missing = items.some((i) => !detailsById.has(i.variantId));
  if (fetched.failed && (missing || !fetched.data)) {
    return <CheckoutLoadError onRetry={() => setAttempt((a) => a + 1)} />;
  }
  if (!fetched.data || missing) return <CheckoutSkeleton />;

  const rows = items.map((item) => ({ item, detail: detailsById.get(item.variantId)! }));
  const blocked = rows.filter(
    ({ detail }) => detail.status === "UNAVAILABLE" || detail.status === "OUT_OF_STOCK",
  );
  const valid = rows.flatMap(({ item, detail }) => {
    if (detail.status === "UNAVAILABLE" || detail.status === "OUT_OF_STOCK") return [];
    return [
      { detail, variantId: item.variantId, quantity: effectiveQuantity(detail, item.quantity) },
    ];
  });

  const threshold = fetched.data.freeShippingThreshold;
  const subtotal = calculateSubtotal(
    valid.map(({ detail, quantity }) => ({ unitPrice: detail.unitPrice, quantity })),
  );
  const zone = zones.find((z) => z.governorate === values.governorate);
  const totals = zone
    ? calculateTotal({ subtotal, zoneFee: zone.fee, freeShippingThreshold: threshold })
    : null;
  const remaining = amountToFreeShipping(subtotal, threshold);
  const canSubmit = blocked.length === 0 && valid.length > 0 && !submitting;

  function setField(name: keyof Values, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !canSubmit) return; // ref: blocks a double click before state updates
    setFormError(null);

    const form = new FormData(event.currentTarget);
    keyRef.current ??= getCheckoutKey();
    const payload = {
      ...values,
      website: String(form.get("website") ?? ""),
      idempotencyKey: keyRef.current,
      items: valid.map(({ variantId, quantity }) => ({ variantId, quantity })),
    };

    const check = checkoutSchema.safeParse(payload);
    if (!check.success) {
      const fieldErrors = toFieldErrors(check.error);
      setErrors(fieldErrors);
      setFormError(s.errors.invalidForm);
      const firstInvalid = FIELD_ORDER.find((name) => fieldErrors[name]);
      if (firstInvalid) document.getElementById(firstInvalid)?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await placeOrder(payload);
      if (result.ok) {
        // Clear the cart only now that the order exists.
        setRedirecting(true);
        clearCheckoutKey();
        clear();
        router.push(
          `/order/confirmation?number=${encodeURIComponent(result.number)}&token=${encodeURIComponent(result.token)}`,
        );
        return; // stay "submitting" until the page changes
      }
      if (result.code === "STOCK_CONFLICT") {
        clearCheckoutKey();
        keyRef.current = null;
        toast.error(result.error, { duration: 8000 });
        router.push("/cart"); // the cart page re-fetches stock and adjusts the lines
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      setFormError(result.error);
    } catch {
      setFormError(s.errors.network);
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <form id="checkout-form" onSubmit={onSubmit} noValidate className="space-y-8">
        <fieldset className="space-y-4" disabled={submitting}>
          <legend className="mb-3 text-lg font-semibold">{s.sections.contact}</legend>
          <Field id="customerName" label={f.customerName} error={errors.customerName}>
            <Input
              id="customerName"
              name="name"
              autoComplete="name"
              value={values.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              maxLength={80}
              aria-invalid={!!errors.customerName}
              aria-describedby={errors.customerName ? "customerName-error" : undefined}
              className="h-11 text-base"
            />
          </Field>
          <Field id="phone" label={f.phone} help={f.phoneHelp} error={errors.phone}>
            <Input
              id="phone"
              name="tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={f.phonePlaceholder}
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
              maxLength={24}
              aria-invalid={!!errors.phone}
              aria-describedby={describedBy("phone", !!errors.phone)}
              className="h-11 text-base"
            />
          </Field>
          <Field id="email" label={f.email} help={f.emailHelp} error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              maxLength={254}
              aria-invalid={!!errors.email}
              aria-describedby={describedBy("email", !!errors.email)}
              className="h-11 text-base"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4" disabled={submitting}>
          <legend className="mb-3 text-lg font-semibold">{s.sections.delivery}</legend>
          <Field id="governorate" label={f.governorate} error={errors.governorate}>
            <select
              id="governorate"
              name="governorate"
              autoComplete="address-level1"
              value={values.governorate}
              onChange={(e) => setField("governorate", e.target.value)}
              aria-invalid={!!errors.governorate}
              aria-describedby={errors.governorate ? "governorate-error" : undefined}
              className={selectClass}
            >
              <option value="">{f.governoratePlaceholder}</option>
              {zones.map((z) => (
                <option key={z.governorate} value={z.governorate}>
                  {z.governorate}
                </option>
              ))}
            </select>
          </Field>
          <Field id="city" label={f.city} error={errors.city}>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              value={values.city}
              onChange={(e) => setField("city", e.target.value)}
              maxLength={80}
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? "city-error" : undefined}
              className="h-11 text-base"
            />
          </Field>
          <Field id="address" label={f.address} error={errors.address}>
            <Textarea
              id="address"
              name="address"
              autoComplete="street-address"
              placeholder={f.addressPlaceholder}
              value={values.address}
              onChange={(e) => setField("address", e.target.value)}
              maxLength={250}
              rows={3}
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "address-error" : undefined}
              className="text-base"
            />
          </Field>
          <Field id="notes" label={f.notes} error={errors.notes}>
            <Textarea
              id="notes"
              name="notes"
              autoComplete="off"
              placeholder={f.notesPlaceholder}
              value={values.notes}
              onChange={(e) => setField("notes", e.target.value)}
              maxLength={500}
              rows={2}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? "notes-error" : undefined}
              className="text-base"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-lg font-semibold">{s.sections.payment}</legend>
          <label className="border-primary bg-primary/5 flex items-start gap-3 rounded-xl border p-4">
            <input type="radio" name="payment" value="cod" checked readOnly className="mt-1" />
            <span>
              <span className="block font-medium">{s.payment.label}</span>
              <span className="text-muted-foreground block text-sm">{s.payment.text}</span>
            </span>
          </label>
        </fieldset>

        {/* Honeypot: invisible to people, tempting to bots. Must stay empty. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            {f.website}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
      </form>

      <aside
        aria-label={s.sections.summary}
        className="space-y-4 rounded-xl border p-4 lg:sticky lg:top-20"
      >
        <h2 className="text-lg font-semibold">{s.sections.summary}</h2>

        {blocked.length > 0 && (
          <div
            role="alert"
            data-testid="checkout-blocked"
            className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3 text-sm"
          >
            <p className="font-medium">{s.blocked.title}</p>
            <p className="text-muted-foreground">{s.blocked.text}</p>
            <Link
              href="/cart"
              className={buttonVariants({ variant: "outline", className: "h-9 px-3" })}
            >
              {s.blocked.action}
            </Link>
          </div>
        )}

        {Object.values(adjusted).map((message) => (
          <p
            key={message}
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            {message}
          </p>
        ))}

        <AutoAdjust
          rows={rows}
          onAdjust={(variantId, available, name) => {
            setQuantity(variantId, available);
            setAdjusted((prev) => ({
              ...prev,
              [variantId]: format(s.adjusted, { count: available, name }),
            }));
          }}
        />

        <ul className="divide-y">
          {rows.map(({ item, detail }) => (
            <SummaryLine key={item.variantId} detail={detail} requested={item.quantity} />
          ))}
        </ul>

        {remaining !== null && valid.length > 0 && (
          <p className="text-sm font-medium" data-testid="checkout-free-shipping">
            {remaining === 0
              ? s.summary.freeShippingReached
              : format(s.summary.freeShippingRemaining, { amount: formatTND(remaining) })}
          </p>
        )}

        <dl className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt>{s.summary.subtotal}</dt>
            <dd data-testid="checkout-subtotal">{formatTND(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{s.summary.shipping}</dt>
            <dd data-testid="checkout-shipping">
              {totals
                ? totals.shippingFee === 0
                  ? s.summary.shippingFree
                  : formatTND(totals.shippingFee)
                : s.summary.shippingPending}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t pt-2 text-base font-semibold">
            <dt>{s.summary.total}</dt>
            <dd data-testid="checkout-total" className="whitespace-nowrap">
              {totals ? formatTND(totals.total) : s.summary.totalPending}
            </dd>
          </div>
        </dl>

        {formError && (
          <p role="alert" data-testid="checkout-error" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          form="checkout-form"
          size="lg"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          data-testid="checkout-submit"
          className="h-12 w-full text-base"
        >
          {submitting ? s.submitting : s.submit}
        </Button>
        <p className="text-muted-foreground text-center text-xs">{s.submitNote}</p>
      </aside>
    </div>
  );
}

/**
 * Lowers REDUCED lines to what is available, so the cart, the summary and the order agree
 * (renders nothing). The server never reduces quantities silently: it would answer
 * STOCK_CONFLICT instead.
 */
function AutoAdjust({
  rows,
  onAdjust,
}: {
  rows: { item: { variantId: string; quantity: number }; detail: CartLineDetail }[];
  onAdjust: (variantId: string, available: number, name: string) => void;
}) {
  useEffect(() => {
    for (const { item, detail } of rows) {
      if (detail.status === "REDUCED" && item.quantity > detail.availableQuantity) {
        onAdjust(item.variantId, detail.availableQuantity, detail.productName);
      }
    }
  }, [rows, onAdjust]);
  return null;
}

function describedBy(id: string, hasError: boolean) {
  return hasError ? `${id}-error` : `${id}-help`;
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function SummaryLine({ detail, requested }: { detail: CartLineDetail; requested: number }) {
  if (detail.status === "UNAVAILABLE") {
    return (
      <li className="flex items-center gap-3 py-3 text-sm opacity-70" data-status="UNAVAILABLE">
        <span className="bg-muted size-14 shrink-0 rounded-lg" />
        <span>
          {t.shop.cart.unavailableName} · {t.shop.cart.unavailable}
        </span>
      </li>
    );
  }
  const quantity = effectiveQuantity(detail, requested);
  const soldOut = detail.status === "OUT_OF_STOCK";
  return (
    <li
      className={cn("flex items-start gap-3 py-3 text-sm", soldOut && "opacity-70")}
      data-status={detail.status}
    >
      <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg">
        {detail.imageUrl && (
          <Image src={detail.imageUrl} alt="" fill sizes="56px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{detail.productName}</p>
        <p className="text-muted-foreground">{detail.variantLabel}</p>
        <p className="text-muted-foreground" data-testid="summary-quantity">
          {soldOut ? t.shop.cart.soldOut : format(s.summary.quantity, { count: quantity })}
        </p>
      </div>
      {!soldOut && <p className="shrink-0 font-medium">{formatTND(detail.unitPrice * quantity)}</p>}
    </li>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-label={s.loading} className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-11 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-xl" />
    </div>
  );
}

function CheckoutEmpty() {
  return (
    <div
      data-testid="checkout-empty"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <ShoppingBag className="text-muted-foreground size-10" aria-hidden />
      <h2 className="text-lg font-semibold">{s.empty.title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{s.empty.text}</p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2 h-10 px-4" })}>
        {s.empty.action}
      </Link>
    </div>
  );
}

function CheckoutLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <TriangleAlert className="text-destructive size-10" aria-hidden />
      <h2 className="text-lg font-semibold">{s.loadError.title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{s.loadError.text}</p>
      <Button size="lg" className="mt-2 h-10 px-4" onClick={onRetry}>
        {s.loadError.retry}
      </Button>
    </div>
  );
}
