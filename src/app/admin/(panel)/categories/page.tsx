import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";
import { deleteCategory } from "@/server/categories";

export const metadata = { title: t.admin.categories.title };

const s = t.admin.categories;

export default async function Page() {
  await requireAdmin();

  const categories = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      position: true,
      _count: { select: { products: true, children: true } },
    },
  });

  const roots = categories.filter((c) => !c.parentId);
  const rows = roots.flatMap((root) => [
    { ...root, depth: 0 },
    ...categories.filter((c) => c.parentId === root.id).map((c) => ({ ...c, depth: 1 })),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <Link href="/admin/categories/new" className={buttonVariants()}>
          <Plus />
          {s.new}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{s.empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 p-3"
              style={{ paddingLeft: `${0.75 + c.depth * 2}rem` }}
            >
              <div className="min-w-0 flex-1">
                <p className={c.depth === 0 ? "font-medium" : "text-sm"}>
                  {c.depth === 1 && <span className="text-muted-foreground mr-1">└</span>}
                  {c.name}
                </p>
                <p className="text-muted-foreground text-xs">/{c.slug}</p>
              </div>
              <Badge variant="outline">#{c.position}</Badge>
              <span className="text-muted-foreground text-xs">
                {c._count.products} {s.productsCount}
                {c.depth === 0 && ` · ${c._count.children} ${s.subcategories}`}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/admin/categories/${c.id}/edit`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t.admin.edit}
                </Link>
                <DeleteButton
                  action={deleteCategory.bind(null, c.id)}
                  title={s.deleteTitle}
                  description={s.deleteDescription}
                  itemName={c.name}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
