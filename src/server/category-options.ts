import { db } from "@/lib/db";

export type CategoryOption = { id: string; label: string };

/** Flat, tree-ordered list for <select>s: "Parfums", "Parfums › Homme", ... */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const all = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });
  return all
    .filter((c) => !c.parentId)
    .flatMap((root) => [
      { id: root.id, label: root.name },
      ...all
        .filter((c) => c.parentId === root.id)
        .map((c) => ({ id: c.id, label: `${root.name} › ${c.name}` })),
    ]);
}
