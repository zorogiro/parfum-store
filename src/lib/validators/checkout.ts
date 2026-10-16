import { z } from "zod";
import { normalizeTunisianPhone } from "@/lib/phone";
import { t } from "@/lib/strings";
import { cartItemsSchema } from "@/lib/validators/cart";

const e = t.shop.checkout.errors;

/** Optional text field: empty strings become undefined so "" never reaches the database. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Checkout payload sent by the browser. Prices and totals are deliberately absent: the server
 * recomputes everything from the database. The governorate is checked against ShippingZone in
 * placeOrder (it needs the database).
 */
export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, e.name).max(80, e.name),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeTunisianPhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: e.phone });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z
    .string()
    .trim()
    .max(254, e.email)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.email(e.email).optional()),
  governorate: z.string().trim().min(1, e.governorate).max(80, e.governorate),
  city: z.string().trim().min(2, e.city).max(80, e.city),
  address: z.string().trim().min(5, e.address).max(250, e.address),
  notes: optionalText(500, e.notes),
  /** Honeypot: hidden from humans, so it must be empty. */
  website: z.string().max(0).optional(),
  idempotencyKey: z.uuid(e.idempotencyKey),
  items: cartItemsSchema.min(1, e.items),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** First error message per top-level field, for inline form errors. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
