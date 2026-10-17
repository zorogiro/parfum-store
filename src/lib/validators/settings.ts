import "@/lib/zod-config";
import { z } from "zod";
import { normalizeTunisianPhone } from "@/lib/phone";
import { t } from "@/lib/strings";

const v = t.admin.settings.validation;

export const settingsSchema = z.object({
  /** Stored as "+216XXXXXXXX", the same format as the seed (the footer prints it as is). */
  storePhone: z
    .string()
    .trim()
    .max(30, v.storePhone)
    .transform((value, ctx) => {
      const phone = normalizeTunisianPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: v.storePhone });
        return z.NEVER;
      }
      return phone;
    }),
  notificationEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, v.notificationEmail)
    .pipe(z.email(v.notificationEmail)),
});

export type SettingsInput = z.input<typeof settingsSchema>;
