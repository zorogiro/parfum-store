import { db } from "@/lib/db";
import type { ConfirmationOrder } from "@/lib/checkout-types";
import { orderNumberSchema, trackingTokenSchema } from "@/lib/validators/tracking";
import { tokensEqual } from "./order-token";

/**
 * Order lookups for the confirmation page and the proxy. A wrong number, a wrong token or a
 * malformed value are all indistinguishable (null / false), so nothing can be enumerated.
 */
export async function findOrderForConfirmation(
  rawNumber: unknown,
  rawToken: unknown,
): Promise<ConfirmationOrder | null> {
  const number = orderNumberSchema.safeParse(rawNumber);
  const token = trackingTokenSchema.safeParse(rawToken);
  if (!number.success || !token.success) return null;

  const order = await db.order.findUnique({
    where: { number: number.data },
    select: {
      number: true,
      trackingToken: true,
      createdAt: true,
      customerName: true,
      phone: true,
      governorate: true,
      city: true,
      address: true,
      notes: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      items: {
        orderBy: { id: "asc" },
        select: { productName: true, variantLabel: true, unitPrice: true, quantity: true },
      },
    },
  });
  if (!order || !tokensEqual(order.trackingToken, token.data)) return null;

  const { trackingToken, ...rest } = order;
  void trackingToken;
  return rest;
}

/**
 * Cheap check used by the proxy to answer a wrong confirmation link with a real HTTP 404.
 * Fails open on database errors (the page then makes the final decision).
 */
export async function confirmationLinkIsValid(
  rawNumber: unknown,
  rawToken: unknown,
): Promise<boolean> {
  const number = orderNumberSchema.safeParse(rawNumber);
  const token = trackingTokenSchema.safeParse(rawToken);
  if (!number.success || !token.success) return false;
  try {
    const order = await db.order.findUnique({
      where: { number: number.data },
      select: { trackingToken: true },
    });
    return !!order && tokensEqual(order.trackingToken, token.data);
  } catch {
    console.error("[order] confirmation link check failed, letting the page decide");
    return true;
  }
}
