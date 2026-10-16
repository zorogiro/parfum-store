import { notFound } from "next/navigation";
import { ProductForm, type ProductValues } from "@/components/admin/product-form";
import { db } from "@/lib/db";
import { toTNDInputValue } from "@/lib/money";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";
import { getCategoryOptions } from "@/server/category-options";

export const metadata = { title: t.admin.products.edit };

type StoredOptions = { volumeMl?: number; size?: string; color?: string };

function asOptions(json: unknown): StoredOptions {
  return json && typeof json === "object" ? (json as StoredOptions) : {};
}

export default async function Page({ params }: PageProps<"/admin/products/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { variants: { orderBy: [{ price: "asc" }, { sku: "asc" }] } },
    }),
    getCategoryOptions(),
  ]);
  if (!product) notFound();

  const values: ProductValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand ?? "",
    categoryId: product.categoryId,
    type: product.type,
    isActive: product.isActive,
    variants: product.variants.map((v) => {
      const o = asOptions(v.options);
      return {
        id: v.id,
        label: v.label,
        sku: v.sku,
        price: toTNDInputValue(v.price),
        compareAtPrice: v.compareAtPrice === null ? "" : toTNDInputValue(v.compareAtPrice),
        stock: String(v.stock),
        volumeMl: o.volumeMl === undefined ? "" : String(o.volumeMl),
        size: o.size ?? "",
        color: o.color ?? "",
      };
    }),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.admin.products.edit}</h1>
      <ProductForm product={values} categories={categories} />
    </div>
  );
}
