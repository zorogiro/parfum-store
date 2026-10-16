"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/admin/field";
import { slugify } from "@/lib/slug";
import { t } from "@/lib/strings";
import { PRODUCT_TYPES, type ProductTypeValue } from "@/lib/validators/product";
import { createProduct, updateProduct } from "@/server/products";

const s = t.admin.products;
const sv = s.variants;

export type VariantRow = {
  id: string | null;
  label: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  volumeMl: string;
  size: string;
  color: string;
};

export type ProductValues = {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryId: string;
  type: ProductTypeValue;
  isActive: boolean;
  variants: VariantRow[];
};

export type CategoryOption = { id: string; label: string };

const emptyVariant = (): VariantRow => ({
  id: null,
  label: "",
  sku: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  volumeMl: "",
  size: "",
  color: "",
});

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductValues;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [description, setDescription] = useState(product?.description ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [type, setType] = useState<ProductTypeValue>(product?.type ?? "PERFUME");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.length ? product.variants : [emptyVariant()],
  );
  // Stable React keys: rows can be removed from the middle.
  const nextKey = useRef(variants.length);
  const [keys, setKeys] = useState<number[]>(() => variants.map((_, i) => i));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function patchVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVariant() {
    setVariants((rows) => [...rows, emptyVariant()]);
    setKeys((k) => [...k, nextKey.current++]);
  }

  function removeVariant(index: number) {
    setVariants((rows) => rows.filter((_, i) => i !== index));
    setKeys((k) => k.filter((_, i) => i !== index));
    setErrors({});
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const payload = {
        name,
        slug,
        description,
        brand,
        categoryId,
        type,
        isActive,
        variants: variants.map((v) => ({
          id: v.id,
          label: v.label,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          options: {
            volumeMl: v.volumeMl.trim() ? Number(v.volumeMl) : undefined,
            size: v.size,
            color: v.color,
          },
        })),
      };
      const result = product
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/products");
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-8" noValidate>
      <section className="grid gap-5 sm:grid-cols-2">
        <Field label={s.fields.name} htmlFor="name" error={errors.name} className="sm:col-span-2">
          <Input
            id="name"
            value={name}
            required
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field
          label={s.fields.slug}
          htmlFor="slug"
          error={errors.slug}
          help={s.fields.slugHelp}
          className="sm:col-span-2"
        >
          <Input
            id="slug"
            value={slug}
            aria-invalid={Boolean(errors.slug)}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label={s.fields.brand} htmlFor="brand" error={errors.brand}>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label={s.fields.category} htmlFor="categoryId" error={errors.categoryId}>
          <NativeSelect
            id="categoryId"
            value={categoryId}
            aria-invalid={Boolean(errors.categoryId)}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{s.fields.chooseCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={s.fields.type} htmlFor="type" error={errors.type}>
          <NativeSelect
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as ProductTypeValue)}
          >
            {PRODUCT_TYPES.map((value) => (
              <option key={value} value={value}>
                {s.types[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {s.fields.isActive}
          </label>
        </div>
        <Field
          label={s.fields.description}
          htmlFor="description"
          error={errors.description}
          className="sm:col-span-2"
        >
          <Textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{sv.title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            <Plus />
            {sv.add}
          </Button>
        </div>
        {errors.variants && (
          <p role="alert" className="text-destructive text-sm">
            {errors.variants}
          </p>
        )}

        <div className="space-y-4">
          {variants.map((variant, i) => {
            const err = (field: string) => errors[`variants.${i}.${field}`];
            const id = (field: string) => `v${keys[i]}-${field}`;
            return (
              <fieldset key={keys[i]} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-6">
                <legend className="text-muted-foreground px-1 text-xs font-medium">#{i + 1}</legend>
                <Field
                  label={sv.label}
                  htmlFor={id("label")}
                  error={err("label")}
                  className="sm:col-span-3"
                >
                  <Input
                    id={id("label")}
                    value={variant.label}
                    aria-invalid={Boolean(err("label"))}
                    onChange={(e) => patchVariant(i, { label: e.target.value })}
                  />
                </Field>
                <Field
                  label={sv.sku}
                  htmlFor={id("sku")}
                  error={err("sku")}
                  className="sm:col-span-3"
                >
                  <Input
                    id={id("sku")}
                    value={variant.sku}
                    aria-invalid={Boolean(err("sku"))}
                    onChange={(e) => patchVariant(i, { sku: e.target.value })}
                  />
                </Field>
                <Field
                  label={sv.price}
                  htmlFor={id("price")}
                  error={err("price")}
                  className="sm:col-span-2"
                >
                  <Input
                    id={id("price")}
                    inputMode="decimal"
                    placeholder={sv.pricePlaceholder}
                    value={variant.price}
                    aria-invalid={Boolean(err("price"))}
                    onChange={(e) => patchVariant(i, { price: e.target.value })}
                  />
                </Field>
                <Field
                  label={sv.compareAt}
                  htmlFor={id("compareAtPrice")}
                  error={err("compareAtPrice")}
                  className="sm:col-span-2"
                >
                  <Input
                    id={id("compareAtPrice")}
                    inputMode="decimal"
                    value={variant.compareAtPrice}
                    aria-invalid={Boolean(err("compareAtPrice"))}
                    onChange={(e) => patchVariant(i, { compareAtPrice: e.target.value })}
                  />
                </Field>
                <Field
                  label={sv.stock}
                  htmlFor={id("stock")}
                  error={err("stock")}
                  className="sm:col-span-2"
                >
                  <Input
                    id={id("stock")}
                    type="number"
                    min={0}
                    step={1}
                    value={variant.stock}
                    aria-invalid={Boolean(err("stock"))}
                    onChange={(e) => patchVariant(i, { stock: e.target.value })}
                  />
                </Field>

                {type === "PERFUME" && (
                  <Field
                    label={sv.volumeMl}
                    htmlFor={id("volumeMl")}
                    error={err("options.volumeMl")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id={id("volumeMl")}
                      type="number"
                      min={1}
                      step={1}
                      value={variant.volumeMl}
                      aria-invalid={Boolean(err("options.volumeMl"))}
                      onChange={(e) => patchVariant(i, { volumeMl: e.target.value })}
                    />
                  </Field>
                )}
                {type === "CLOTHING" && (
                  <>
                    <Field
                      label={sv.size}
                      htmlFor={id("size")}
                      error={err("options.size")}
                      className="sm:col-span-2"
                    >
                      <Input
                        id={id("size")}
                        placeholder="S, M, L, 42…"
                        value={variant.size}
                        aria-invalid={Boolean(err("options.size"))}
                        onChange={(e) => patchVariant(i, { size: e.target.value })}
                      />
                    </Field>
                    <Field
                      label={sv.color}
                      htmlFor={id("color")}
                      error={err("options.color")}
                      className="sm:col-span-2"
                    >
                      <Input
                        id={id("color")}
                        value={variant.color}
                        aria-invalid={Boolean(err("options.color"))}
                        onChange={(e) => patchVariant(i, { color: e.target.value })}
                      />
                    </Field>
                  </>
                )}
                {type === "ACCESSORY" && (
                  <Field
                    label={sv.colorOptional}
                    htmlFor={id("color")}
                    error={err("options.color")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id={id("color")}
                      value={variant.color}
                      onChange={(e) => patchVariant(i, { color: e.target.value })}
                    />
                  </Field>
                )}

                <div className="flex items-end justify-end sm:col-span-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={variants.length === 1}
                    onClick={() => removeVariant(i)}
                  >
                    <Trash2 />
                    {sv.remove}
                  </Button>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.admin.saving : t.common.save}
        </Button>
        <Link href="/admin/products" className={buttonVariants({ variant: "outline" })}>
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}
