import "@/lib/zod-config";
import { z } from "zod";
import { MAX_PRODUCT_IMAGES } from "@/lib/cloudinary-validation";
import { parseTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { slugField } from "./category";

const v = t.admin.validation;

export const PRODUCT_TYPES = ["PERFUME", "CLOTHING", "ACCESSORY"] as const;
export type ProductTypeValue = (typeof PRODUCT_TYPES)[number];

const MAX_PRICE_MILLIMES = 100_000_000; // 100 000 TND, well under the Int4 column limit
const MAX_STOCK = 100_000;
export const MAX_VARIANTS = 50;

/** TND typed by the admin ("45.500", "45,5") -> integer millimes. */
const priceField = z
  .string(v.price)
  .trim()
  .refine((s) => parseTND(s) !== null, v.price)
  .transform((s) => parseTND(s) as number)
  .refine((m) => m > 0, v.pricePositive)
  .refine((m) => m <= MAX_PRICE_MILLIMES, v.price);

const optionalPriceField = z
  .string()
  .trim()
  .nullish()
  .transform((s) => (s ? s : undefined))
  .pipe(
    z
      .string()
      .refine((s) => parseTND(s) !== null, v.price)
      .transform((s) => parseTND(s) as number)
      .refine((m) => m > 0 && m <= MAX_PRICE_MILLIMES, v.price)
      .optional(),
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, v.nameTooLong)
    .nullish()
    .transform((s) => (s ? s : undefined));

export const variantOptionsSchema = z.object({
  volumeMl: z
    .number()
    .int()
    .positive()
    .max(5000)
    .nullish()
    .transform((n) => n ?? undefined),
  size: optionalText(20),
  color: optionalText(40),
});

export type VariantOptions = z.output<typeof variantOptionsSchema>;

export const variantSchema = z
  .object({
    id: z.string().max(64).nullish(),
    label: z.string().trim().min(1, v.required).max(80, v.nameTooLong),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, v.required)
      .max(64, v.skuInvalid)
      .regex(/^[A-Z0-9][A-Z0-9._-]*$/, v.skuInvalid),
    price: priceField,
    compareAtPrice: optionalPriceField,
    stock: z.coerce.number(v.stock).int(v.stock).min(0, v.stock).max(MAX_STOCK, v.stock),
    options: variantOptionsSchema,
  })
  .refine(
    (variant) => variant.compareAtPrice === undefined || variant.compareAtPrice > variant.price,
    {
      message: v.compareAtGreater,
      path: ["compareAtPrice"],
    },
  );

/** Keeps only the option keys that make sense for the product type. */
export function normalizeOptions(
  type: ProductTypeValue,
  o: VariantOptions,
): Partial<VariantOptions> {
  switch (type) {
    case "PERFUME":
      return { volumeMl: o.volumeMl };
    case "CLOTHING":
      return { size: o.size, color: o.color };
    case "ACCESSORY":
      return { color: o.color };
  }
}

export const imageSchema = z.object({
  publicId: z.string().max(200),
  url: z.string().max(500),
});

export type ImageInput = z.infer<typeof imageSchema>;

export const productSchema = z
  .object({
    name: z.string().trim().min(1, v.required).max(120, v.nameTooLong),
    slug: slugField,
    description: z.string().trim().max(5000, v.nameTooLong),
    brand: optionalText(80),
    categoryId: z.string().trim().min(1, v.required),
    type: z.enum(PRODUCT_TYPES, v.required),
    isActive: z.boolean(),
    variants: z.array(variantSchema).min(1, v.minVariants).max(MAX_VARIANTS, v.maxVariants),
    /** Ordered: the first image is the cover. */
    images: z.array(imageSchema).max(MAX_PRODUCT_IMAGES, t.admin.products.images.tooMany),
  })
  .superRefine((product, ctx) => {
    const ids = new Set<string>();
    product.images.forEach((image, i) => {
      if (ids.has(image.publicId)) {
        ctx.addIssue({
          code: "custom",
          message: t.admin.products.images.duplicate,
          path: ["images", i],
        });
      }
      ids.add(image.publicId);
    });

    const seen = new Set<string>();
    product.variants.forEach((variant, i) => {
      if (seen.has(variant.sku)) {
        ctx.addIssue({
          code: "custom",
          message: v.skuDuplicateInForm,
          path: ["variants", i, "sku"],
        });
      }
      seen.add(variant.sku);

      const o = variant.options;
      const need = (ok: boolean, key: string, message: string) => {
        if (!ok) ctx.addIssue({ code: "custom", message, path: ["variants", i, "options", key] });
      };
      if (product.type === "PERFUME") need(o.volumeMl !== undefined, "volumeMl", v.volume);
      if (product.type === "CLOTHING") {
        need(o.size !== undefined, "size", v.size);
        need(o.color !== undefined, "color", v.color);
      }
    });
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
