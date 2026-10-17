import "@/lib/zod-config";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/order-status";
import { t } from "@/lib/strings";
import { idSchema } from "@/lib/validators/category";

const v = t.admin.orders.validation;

export const NOTE_MAX = 500;
export const ADMIN_NOTE_MAX = 1000;

export const changeStatusSchema = z.object({
  orderId: idSchema,
  toStatus: z.enum(ORDER_STATUSES, v.status),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX, v.noteTooLong)
    .optional()
    .transform((note) => (note ? note : null)),
});

export const adminNoteSchema = z.object({
  orderId: idSchema,
  note: z
    .string()
    .trim()
    .max(ADMIN_NOTE_MAX, v.adminNoteTooLong)
    .transform((note) => (note ? note : null)),
});
