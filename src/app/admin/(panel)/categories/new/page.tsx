import { CategoryForm } from "@/components/admin/category-form";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: t.admin.categories.new };

export default async function Page() {
  await requireAdmin();
  const parents = await db.category.findMany({
    where: { parentId: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.admin.categories.new}</h1>
      <CategoryForm parents={parents} />
    </div>
  );
}
