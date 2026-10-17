"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@/generated/prisma/client";
import { fail, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import {
  canTransition,
  isOrderStatus,
  restoresStock,
  STATUS_LABELS,
  type OrderStatusValue,
} from "@/lib/order-status";
import { format } from "@/lib/utils";
import { t } from "@/lib/strings";
import { adminNoteSchema, changeStatusSchema } from "@/lib/validators/admin-orders";
import { fieldErrorsFrom } from "@/lib/validators/category";
import { requireAdmin } from "@/server/auth";
import { revalidateStock } from "@/server/catalog-utils";

const s = t.admin.orders;

/** Thrown inside the transaction to roll it back with a user-facing message. */
class StatusChangeError extends Error {
  constructor(
    message: string,
    readonly currentStatus?: OrderStatusValue,
  ) {
    super(message);
  }
}

function revalidateAdminOrders(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin"); // dashboard counters
}

/** Never log personal data or driver messages: only the error kind. */
function logError(where: string, error: unknown) {
  console.error(`[orders] ${where} failed (${error instanceof Error ? error.name : "unknown"})`);
}

/**
 * Moves an order to a new status. The order row is locked (SELECT ... FOR UPDATE) and its status
 * re-read inside the transaction, so a stale page or a second admin can never apply a transition
 * that is no longer valid. Entering CANCELLED or RETURNED puts the items back in stock in the same
 * transaction; both statuses are final and reachable once, so stock is restored at most once.
 */
export async function changeOrderStatus(
  orderId: string,
  toStatus: string,
  note?: string,
): Promise<ActionResult<{ status: OrderStatusValue }>> {
  const admin = await requireAdmin();

  const parsed = changeStatusSchema.safeParse({ orderId, toStatus, note });
  if (!parsed.success) return fail(s.errors.invalidTransition, fieldErrorsFrom(parsed.error));
  const { toStatus: to, note: cleanNote } = parsed.data;

  let restored = false;
  try {
    await db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ status: string }[]>`
          SELECT "status"::text AS "status" FROM "Order" WHERE "id" = ${parsed.data.orderId} FOR UPDATE`;
        const current = rows[0]?.status;
        if (current === undefined) throw new StatusChangeError(s.errors.notFound);
        if (!isOrderStatus(current)) throw new StatusChangeError(s.errors.invalidTransition);

        if (!canTransition(current, to)) {
          throw new StatusChangeError(s.errors.invalidTransition, current);
        }

        if (restoresStock(to)) {
          // Same order for every transaction: no deadlock between two orders sharing variants.
          const items = await tx.orderItem.findMany({
            where: { orderId: parsed.data.orderId },
            select: { variantId: true, quantity: true },
            orderBy: { variantId: "asc" },
          });
          for (const item of items) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
          restored = items.length > 0;
        }

        await tx.order.update({
          where: { id: parsed.data.orderId },
          data: { status: to as OrderStatus },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: parsed.data.orderId,
            fromStatus: current as OrderStatus,
            toStatus: to as OrderStatus,
            changedBy: admin.email,
            note: cleanNote,
          },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (error) {
    if (error instanceof StatusChangeError) {
      if (error.currentStatus) revalidateAdminOrders(parsed.data.orderId);
      return fail(
        error.currentStatus
          ? format(s.errors.alreadyChanged, { status: STATUS_LABELS[error.currentStatus] })
          : error.message,
      );
    }
    logError("changeOrderStatus", error);
    return fail(t.admin.unexpected);
  }

  if (restored) revalidateStock(); // "Épuisé" badges and stock labels on the storefront
  revalidateAdminOrders(parsed.data.orderId);
  return {
    ok: true,
    status: to,
    message: format(s.statusPanel.updated, { status: STATUS_LABELS[to] }),
  };
}

/** Saves the internal (admin-only) note of an order. Empty clears it. */
export async function updateAdminNote(orderId: string, note: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = adminNoteSchema.safeParse({ orderId, note });
  if (!parsed.success) return fail(s.validation.adminNoteTooLong, fieldErrorsFrom(parsed.error));

  try {
    const { count } = await db.order.updateMany({
      where: { id: parsed.data.orderId },
      data: { adminNote: parsed.data.note },
    });
    if (count !== 1) return fail(s.errors.notFound);
  } catch (error) {
    logError("updateAdminNote", error);
    return fail(t.admin.unexpected);
  }

  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true, message: s.adminNote.saved };
}
