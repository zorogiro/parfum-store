"use server";

import { db } from "@/lib/db";
import { isProductImagePublicId } from "@/lib/cloudinary-validation";
import { fail, type ActionResult } from "@/lib/action-result";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";
import { destroyImages, signProductUpload } from "@/server/cloudinary";

type UploadSignature = NonNullable<ReturnType<typeof signProductUpload>>;

/** Signed parameters for a direct browser -> Cloudinary upload. */
export async function getUploadSignature(): Promise<ActionResult<{ upload: UploadSignature }>> {
  await requireAdmin();
  const upload = signProductUpload();
  if (!upload) return fail(t.admin.products.images.notConfigured);
  return { ok: true, upload };
}

/**
 * Deletes a file that was uploaded but never attached to a product (the admin
 * removed it before saving). Refuses anything attached to a product.
 */
export async function discardUploadedImage(publicId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isProductImagePublicId(publicId)) return fail(t.admin.products.images.invalid);

  const attached = await db.productImage.findFirst({ where: { publicId }, select: { id: true } });
  if (attached) return fail(t.admin.products.images.inUse);

  await destroyImages([publicId]);
  return { ok: true };
}
