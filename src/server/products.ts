"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logServerError } from "./log";
import { fail, type ActionResult } from "@/lib/action-result";
import { isProductImagePublicId, isProductImageUrl } from "@/lib/cloudinary-validation";
import { slugify, uniqueSlug } from "@/lib/slug";
import { t } from "@/lib/strings";
import { fieldErrorsFrom, idSchema } from "@/lib/validators/category";
import {
  normalizeOptions,
  productSchema,
  type ProductData,
  type ProductInput,
} from "@/lib/validators/product";
import { requireAdmin } from "@/server/auth";
import { ActionError, revalidateCatalog, uniqueViolation } from "@/server/catalog-utils";
import { destroyImages, getCloudName } from "@/server/cloudinary";

const s = t.admin.products;
const slugTakenErrors = { slug: t.admin.errors.slugTaken };

function optionsJson(data: ProductData, i: number): Prisma.InputJsonObject {
  const clean = normalizeOptions(data.type, data.variants[i].options);
  return JSON.parse(JSON.stringify(clean)) as Prisma.InputJsonObject;
}

async function resolveSlug(name: string, requested: string, selfId?: string) {
  if (requested) {
    const clash = await db.product.findFirst({
      where: { slug: requested, ...(selfId && { id: { not: selfId } }) },
      select: { id: true },
    });
    return clash ? null : requested;
  }
  const base = slugify(name);
  const existing = await db.product.findMany({
    where: { slug: { startsWith: base || "produit" }, ...(selfId && { id: { not: selfId } }) },
    select: { slug: true },
  });
  return uniqueSlug(
    base,
    existing.map((p) => p.slug),
    "produit",
  );
}

/** SKUs already used by variants that don't belong to this product. */
async function skuErrors(data: ProductData, productId?: string) {
  const taken = await db.variant.findMany({
    where: {
      sku: { in: data.variants.map((v) => v.sku) },
      ...(productId && { productId: { not: productId } }),
    },
    select: { sku: true },
  });
  const takenSet = new Set(taken.map((v) => v.sku));
  const errors: Record<string, string> = {};
  data.variants.forEach((variant, i) => {
    if (takenSet.has(variant.sku)) errors[`variants.${i}.sku`] = t.admin.errors.skuTaken;
  });
  return errors;
}

/**
 * Images must live in OUR cloud and OUR folder (never trust the client's URL),
 * and a file may belong to one product only.
 */
async function imageErrors(data: ProductData, productId?: string) {
  const cloudName = getCloudName();
  const errors: Record<string, string> = {};
  // Images already saved on this product (e.g. seeded samples) are kept as they are;
  // only newly attached ones must prove they come from our Cloudinary folder.
  const existing = productId
    ? await db.productImage.findMany({
        where: { productId },
        select: { publicId: true, url: true },
      })
    : [];
  const alreadySaved = (image: { publicId: string; url: string }) =>
    existing.some((e) => e.publicId === image.publicId && e.url === image.url);
  data.images.forEach((image, i) => {
    if (alreadySaved(image)) return;
    if (
      !isProductImagePublicId(image.publicId) ||
      !isProductImageUrl(image.url, cloudName, image.publicId)
    ) {
      errors[`images.${i}`] = s.images.invalid;
    }
  });
  if (Object.keys(errors).length > 0) return errors;

  const used = await db.productImage.findMany({
    where: {
      publicId: { in: data.images.filter((i) => !alreadySaved(i)).map((i) => i.publicId) },
      ...(productId && { productId: { not: productId } }),
    },
    select: { publicId: true },
  });
  const usedSet = new Set(used.map((image) => image.publicId));
  data.images.forEach((image, i) => {
    if (usedSet.has(image.publicId)) errors[`images.${i}`] = s.images.inUse;
  });
  return errors;
}

async function validate(input: ProductInput, productId?: string) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      result: fail(t.admin.validation.invalidData, fieldErrorsFrom(parsed.error)),
    };
  }
  const data = parsed.data;

  const category = await db.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category)
    return {
      ok: false as const,
      result: fail(s.categoryInvalid, { categoryId: s.categoryInvalid }),
    };

  const slug = await resolveSlug(data.name, data.slug, productId);
  if (!slug) return { ok: false as const, result: fail(t.admin.errors.slugTaken, slugTakenErrors) };

  const skus = await skuErrors(data, productId);
  if (Object.keys(skus).length > 0)
    return { ok: false as const, result: fail(t.admin.errors.skuTaken, skus) };

  const images = await imageErrors(data, productId);
  if (Object.keys(images).length > 0) {
    return {
      ok: false as const,
      result: fail(Object.values(images)[0], { images: Object.values(images)[0] }),
    };
  }

  return { ok: true as const, data, slug };
}

function uniqueErrorResult(error: unknown) {
  const kind = uniqueViolation(error);
  if (kind === "slug") return fail(t.admin.errors.slugTaken, slugTakenErrors);
  if (kind === "sku") return fail(t.admin.errors.skuTaken);
  return null;
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const checked = await validate(input);
  if (!checked.ok) return checked.result;
  const { data, slug } = checked;

  try {
    const product = await db.product.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        brand: data.brand ?? null,
        categoryId: data.categoryId,
        type: data.type,
        isActive: data.isActive,
        images: {
          create: data.images.map((image, position) => ({
            url: image.url,
            publicId: image.publicId,
            position,
          })),
        },
        variants: {
          create: data.variants.map((v, i) => ({
            sku: v.sku,
            label: v.label,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            stock: v.stock,
            options: optionsJson(data, i),
          })),
        },
      },
      select: { id: true },
    });
    revalidateCatalog();
    return { ok: true, message: s.created, id: product.id };
  } catch (error) {
    const known = uniqueErrorResult(error);
    if (known) return known;
    logServerError("createProduct", error);
    return fail(t.admin.errors.unexpected);
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  if (!idSchema.safeParse(id).success) return fail(t.admin.errors.notFound);
  const exists = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return fail(t.admin.errors.notFound);

  const checked = await validate(input, id);
  if (!checked.ok) return checked.result;
  const { data, slug } = checked;

  let removedImages: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          slug,
          description: data.description,
          brand: data.brand ?? null,
          categoryId: data.categoryId,
          type: data.type,
          isActive: data.isActive,
        },
      });

      const current = await tx.variant.findMany({
        where: { productId: id },
        select: { id: true, sku: true },
      });
      const currentIds = new Set(current.map((v) => v.id));

      const submittedIds = new Set<string>();
      data.variants.forEach((v, i) => {
        if (!v.id) return;
        if (!currentIds.has(v.id) || submittedIds.has(v.id)) {
          throw new ActionError(s.variantUnknown, { [`variants.${i}.sku`]: s.variantUnknown });
        }
        submittedIds.add(v.id);
      });

      // Variants removed from the form: refuse if any order references them.
      const removed = current.filter((v) => !submittedIds.has(v.id));
      if (removed.length > 0) {
        const sold = await tx.orderItem.findFirst({
          where: { variantId: { in: removed.map((v) => v.id) } },
          select: { variantId: true },
        });
        if (sold) {
          const sku = removed.find((v) => v.id === sold.variantId)?.sku ?? "";
          throw new ActionError(s.variantInOrders.replace("{sku}", sku));
        }
        await tx.variant.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } });
      }

      // Images: drop removed ones, re-number the kept ones, add the new ones.
      const currentImages = await tx.productImage.findMany({
        where: { productId: id },
        select: { id: true, publicId: true },
      });
      const submitted = new Set(data.images.map((image) => image.publicId));
      const kept = new Map(currentImages.map((image) => [image.publicId, image.id]));
      removedImages = currentImages
        .filter((i) => !submitted.has(i.publicId))
        .map((i) => i.publicId);
      await tx.productImage.deleteMany({
        where: { productId: id, publicId: { in: removedImages } },
      });
      for (const [position, image] of data.images.entries()) {
        const existingId = kept.get(image.publicId);
        if (existingId) {
          await tx.productImage.update({ where: { id: existingId }, data: { position } });
        } else {
          await tx.productImage.create({
            data: { productId: id, url: image.url, publicId: image.publicId, position },
          });
        }
      }

      // Updates first, then creates, so a freed SKU can be reused by a new row.
      for (const [i, v] of data.variants.entries()) {
        if (!v.id) continue;
        await tx.variant.update({
          where: { id: v.id },
          data: {
            sku: v.sku,
            label: v.label,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            stock: v.stock,
            options: optionsJson(data, i),
          },
        });
      }
      for (const [i, v] of data.variants.entries()) {
        if (v.id) continue;
        await tx.variant.create({
          data: {
            productId: id,
            sku: v.sku,
            label: v.label,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            stock: v.stock,
            options: optionsJson(data, i),
          },
        });
      }
    });
    await destroyImages(removedImages);
    revalidateCatalog();
    return { ok: true, message: s.updated, id };
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message, error.fieldErrors);
    const known = uniqueErrorResult(error);
    if (known) return known;
    logServerError("updateProduct", error);
    return fail(t.admin.errors.unexpected);
  }
}

const toggleSchema = z.object({ id: idSchema, isActive: z.boolean() });

export async function setProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();

  const parsed = toggleSchema.safeParse({ id, isActive });
  if (!parsed.success) return fail(t.admin.validation.invalidData);

  try {
    await db.product.update({ where: { id: parsed.data.id }, data: { isActive } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail(t.admin.errors.notFound);
    }
    logServerError("setProductActive", error);
    return fail(t.admin.errors.unexpected);
  }
  revalidateCatalog();
  return { ok: true, message: isActive ? s.enabled : s.disabled };
}

/**
 * Hard-deletes a product only when no order references its variants; otherwise
 * it is soft-disabled (isActive = false) so order history stays intact.
 */
export async function deleteProduct(id: string): Promise<ActionResult<{ softDisabled: boolean }>> {
  await requireAdmin();

  if (!idSchema.safeParse(id).success) return fail(t.admin.errors.notFound);
  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, images: { select: { publicId: true } } },
  });
  if (!product) return fail(t.admin.errors.notFound);

  const hasOrders = async () =>
    (await db.orderItem.count({ where: { variant: { productId: id } } })) > 0;
  const disable = async (): Promise<ActionResult<{ softDisabled: boolean }>> => {
    await db.product.update({ where: { id }, data: { isActive: false } });
    revalidateCatalog();
    return { ok: true, message: s.softDisabled, softDisabled: true };
  };

  try {
    if (await hasOrders()) return await disable();
    await db.product.delete({ where: { id } });
  } catch (error) {
    // An order was placed between the check and the delete (FK Restrict on OrderItem).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return await disable();
    }
    logServerError("deleteProduct", error);
    return fail(t.admin.errors.unexpected);
  }
  await destroyImages(product.images.map((image) => image.publicId));
  revalidateCatalog();
  return { ok: true, message: s.deleted, softDisabled: false };
}
