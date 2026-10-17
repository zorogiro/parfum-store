"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { fieldErrorsFrom } from "@/lib/validators/category";
import { settingsSchema, type SettingsInput } from "@/lib/validators/settings";
import { requireAdmin } from "@/server/auth";

/** Store phone (stored as "+216XXXXXXXX", like the seed) and order notification email. */
export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(t.admin.validation.invalidData, fieldErrorsFrom(parsed.error));
  const { storePhone, notificationEmail } = parsed.data;

  try {
    await db.$transaction([
      db.setting.upsert({
        where: { key: "storePhone" },
        create: { key: "storePhone", value: storePhone },
        update: { value: storePhone },
      }),
      db.setting.upsert({
        where: { key: "notificationEmail" },
        create: { key: "notificationEmail", value: notificationEmail },
        update: { value: notificationEmail },
      }),
    ]);
  } catch (error) {
    console.error(`[settings] update failed (${error instanceof Error ? error.name : "unknown"})`);
    return fail(t.admin.unexpected);
  }

  updateTag("settings"); // the footer phone is cached with this tag
  revalidatePath("/admin/settings");
  return { ok: true, message: t.admin.settings.saved };
}
