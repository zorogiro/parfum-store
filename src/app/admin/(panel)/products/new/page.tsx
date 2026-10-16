import { ProductForm } from "@/components/admin/product-form";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";
import { getCategoryOptions } from "@/server/category-options";

export const metadata = { title: t.admin.products.new };

export default async function Page() {
  await requireAdmin();
  const categories = await getCategoryOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.admin.products.new}</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
