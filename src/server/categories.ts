"use server";

import { db } from "@/lib/db";
import { fail, type ActionResult } from "@/lib/action-result";
import { slugify, uniqueSlug } from "@/lib/slug";
import { t } from "@/lib/strings";
import {
  categorySchema,
  fieldErrorsFrom,
  idSchema,
  type CategoryInput,
} from "@/lib/validators/category";
import { requireAdmin } from "@/server/auth";
import { revalidateCatalog, uniqueViolation } from "@/server/catalog-utils";

const s = t.admin.categories;

/** Max 2 levels: the parent must be a root category, and a category with children can't be nested. */
async function checkParent(parentId: string | null, selfId?: string): Promise<string | null> {
  if (!parentId) return null;
  if (parentId === selfId) return s.parentSelf;

  const parent = await db.category.findUnique({
    where: { id: parentId },
    select: { parentId: true },
  });
  if (!parent) return s.parentInvalid;
  if (parent.parentId) return s.parentNotRoot;

  if (selfId && (await db.category.count({ where: { parentId: selfId } })) > 0) {
    return s.hasChildrenCannotNest;
  }
  return null;
}

async function resolveSlug(name: string, requested: string, selfId?: string) {
  if (requested) {
    const clash = await db.category.findFirst({
      where: { slug: requested, ...(selfId && { id: { not: selfId } }) },
      select: { id: true },
    });
    return clash ? null : requested;
  }
  const base = slugify(name);
  const existing = await db.category.findMany({
    where: { slug: { startsWith: base || "categorie" }, ...(selfId && { id: { not: selfId } }) },
    select: { slug: true },
  });
  return uniqueSlug(
    base,
    existing.map((c) => c.slug),
    "categorie",
  );
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(t.admin.validation.invalidData, fieldErrorsFrom(parsed.error));
  const data = parsed.data;

  const parentError = await checkParent(data.parentId);
  if (parentError) return fail(parentError, { parentId: parentError });

  const slug = await resolveSlug(data.name, data.slug);
  if (!slug) return fail(t.admin.errors.slugTaken, { slug: t.admin.errors.slugTaken });

  try {
    const created = await db.category.create({
      data: { name: data.name, slug, parentId: data.parentId, position: data.position },
      select: { id: true },
    });
    revalidateCatalog();
    return { ok: true, message: s.created, id: created.id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return fail(t.admin.errors.slugTaken, { slug: t.admin.errors.slugTaken });
    }
    console.error("createCategory failed", error);
    return fail(t.admin.errors.unexpected);
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const idParsed = idSchema.safeParse(id);
  const parsed = categorySchema.safeParse(input);
  if (!idParsed.success) return fail(t.admin.errors.notFound);
  if (!parsed.success) return fail(t.admin.validation.invalidData, fieldErrorsFrom(parsed.error));
  const data = parsed.data;

  const existing = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail(t.admin.errors.notFound);

  const parentError = await checkParent(data.parentId, id);
  if (parentError) return fail(parentError, { parentId: parentError });

  const slug = await resolveSlug(data.name, data.slug, id);
  if (!slug) return fail(t.admin.errors.slugTaken, { slug: t.admin.errors.slugTaken });

  try {
    await db.category.update({
      where: { id },
      data: { name: data.name, slug, parentId: data.parentId, position: data.position },
    });
    revalidateCatalog();
    return { ok: true, message: s.updated, id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return fail(t.admin.errors.slugTaken, { slug: t.admin.errors.slugTaken });
    }
    console.error("updateCategory failed", error);
    return fail(t.admin.errors.unexpected);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return fail(t.admin.errors.notFound);

  const category = await db.category.findUnique({
    where: { id },
    select: { _count: { select: { children: true, products: true } } },
  });
  if (!category) return fail(t.admin.errors.notFound);

  if (category._count.children > 0) return fail(s.blockedChildren);
  if (category._count.products > 0) return fail(s.blockedProducts);

  try {
    await db.category.delete({ where: { id } });
  } catch (error) {
    // A product/subcategory was added between the check and the delete (FK Restrict).
    console.error("deleteCategory failed", error);
    return fail(s.blockedProducts);
  }
  revalidateCatalog();
  return { ok: true, message: s.deleted };
}
