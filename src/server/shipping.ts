"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { fieldErrorsFrom } from "@/lib/validators/category";
import { shippingSchema, type ShippingInput } from "@/lib/validators/shipping";
import { requireAdmin } from "@/server/auth";

const s = t.admin.shipping;

/**
 * Saves every governorate fee and the free-shipping threshold in one transaction.
 * Fees are typed in TND by the admin and stored in millimes; a threshold of 0 disables the offer.
 */
export async function updateShipping(input: ShippingInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success) return fail(t.admin.validation.invalidData, fieldErrorsFrom(parsed.error));
  const { zones, threshold } = parsed.data;

  if (new Set(zones.map((z) => z.id)).size !== zones.length) return fail(s.validation.invalid);

  try {
    await db.$transaction(async (tx) => {
      const known = await tx.shippingZone.findMany({
        where: { id: { in: zones.map((z) => z.id) } },
        select: { id: true, fee: true },
      });
      if (known.length !== zones.length) throw new Error("UNKNOWN_ZONE");

      // Only write the fees that changed: 24 sequential UPDATEs are slow on a remote database.
      const current = new Map(known.map((z) => [z.id, z.fee]));
      for (const zone of zones.filter((z) => current.get(z.id) !== z.fee)) {
        await tx.shippingZone.update({ where: { id: zone.id }, data: { fee: zone.fee } });
      }
      await tx.setting.upsert({
        where: { key: "freeShippingThreshold" },
        create: { key: "freeShippingThreshold", value: String(threshold) },
        update: { value: String(threshold) },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNKNOWN_ZONE") return fail(s.unknownZone);
    console.error(`[shipping] update failed (${error instanceof Error ? error.name : "unknown"})`);
    return fail(t.admin.unexpected);
  }

  updateTag("settings"); // getShippingZones() and getFreeShippingThreshold() on the storefront
  revalidatePath("/admin/shipping");
  return { ok: true, message: s.saved };
}
