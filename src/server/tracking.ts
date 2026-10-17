"use server";

import { db } from "@/lib/db";
import type { TrackOrderResult } from "@/lib/checkout-types";
import { normalizeTunisianPhone } from "@/lib/phone";
import { t } from "@/lib/strings";
import { orderNumberSchema, trackingLookupSchema } from "@/lib/validators/tracking";
import { trackingLimiter } from "./rate-limiters";
import { getClientIp } from "./request-ip";

const s = t.shop.tracking;
const notFound = (): TrackOrderResult => ({ ok: false, code: "NOT_FOUND", error: s.notFound });

/**
 * PUBLIC action for /suivi. Order number + phone must both match. Every mismatch (bad format,
 * unknown number, wrong phone) returns the same message so order numbers cannot be enumerated.
 * The result never contains the street address, the customer's name or phone.
 */
export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  const ip = await getClientIp();
  const key = `ip:${ip}`;

  // Atomic: every lookup counts, hit or miss, and concurrent requests cannot all slip under.
  if (!(await trackingLimiter.consume(key))) {
    return { ok: false, code: "RATE_LIMITED", error: s.rateLimited };
  }

  const parsed = trackingLookupSchema.safeParse(input);
  if (!parsed.success) return notFound();
  const number = orderNumberSchema.safeParse(parsed.data.number);
  const phone = normalizeTunisianPhone(parsed.data.phone);
  if (!number.success || !phone) return notFound();

  try {
    const order = await db.order.findUnique({
      where: { number: number.data },
      select: {
        number: true,
        phone: true,
        status: true,
        createdAt: true,
        governorate: true,
        subtotal: true,
        shippingFee: true,
        total: true,
        items: {
          orderBy: { id: "asc" },
          select: { productName: true, variantLabel: true, unitPrice: true, quantity: true },
        },
      },
    });
    if (!order || order.phone !== phone) return notFound();

    return {
      ok: true,
      order: {
        number: order.number,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        governorate: order.governorate,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        total: order.total,
        items: order.items,
      },
    };
  } catch {
    console.error("[tracking] lookup failed");
    return { ok: false, code: "UNEXPECTED", error: s.unexpected };
  }
}
