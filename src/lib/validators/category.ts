import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";
import { t } from "@/lib/strings";

const v = t.admin.validation;

/** Empty string means "generate from the name". */
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(100, v.slugInvalid)
  .refine((s) => s === "" || SLUG_PATTERN.test(s), v.slugInvalid);

export const idSchema = z.string().trim().min(1).max(64);

export const categorySchema = z.object({
  name: z.string().trim().min(1, v.required).max(80, v.nameTooLong),
  slug: slugField,
  parentId: z
    .string()
    .nullish()
    .transform((id) => (id ? id : null)),
  position: z.coerce.number(v.position).int(v.position).min(0, v.position).max(9999, v.position),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type CategoryData = z.output<typeof categorySchema>;

/** Flattens a Zod error into { "variants.0.sku": "message" }, keeping the first message per path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
