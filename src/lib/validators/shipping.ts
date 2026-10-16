import { z } from "zod";
import { parseTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { idSchema } from "@/lib/validators/category";

const v = t.admin.shipping.validation;

/** 100 TND in millimes. */
export const MAX_FEE_MILLIMES = 100_000;
/** The threshold has no upper bound in the plan; this keeps it a sane amount (1 000 000 TND). */
export const MAX_THRESHOLD_MILLIMES = 1_000_000_000;

const feeField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const millimes = parseTND(value);
    if (millimes === null || millimes > MAX_FEE_MILLIMES) {
      ctx.addIssue({ code: "custom", message: v.fee });
      return z.NEVER;
    }
    return millimes;
  });

/** Empty or 0 disables free shipping (stored as "0"). */
const thresholdField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return 0;
    const millimes = parseTND(value);
    if (millimes === null || millimes > MAX_THRESHOLD_MILLIMES) {
      ctx.addIssue({ code: "custom", message: v.threshold });
      return z.NEVER;
    }
    return millimes;
  });

export const shippingSchema = z.object({
  zones: z
    .array(z.object({ id: idSchema, fee: feeField }))
    .min(1, v.invalid)
    .max(100, v.invalid),
  threshold: thresholdField,
});

export type ShippingInput = z.input<typeof shippingSchema>;
