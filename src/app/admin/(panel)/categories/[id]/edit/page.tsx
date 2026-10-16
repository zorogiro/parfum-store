import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: t.admin.categories.edit };

export default async function Page({ params }: PageProps<"/admin/categories/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;

  const category = await db.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      position: true,
      _count: { select: { children: true } },
    },
  });
  if (!category) notFound();

  const parents = await db.category.findMany({
    where: { parentId: null, id: { not: id } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.admin.categories.edit}</h1>
      <CategoryForm
        category={category}
        parents={parents}
        hasChildren={category._count.children > 0}
      />
    </div>
  );
}
