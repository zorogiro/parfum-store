"use server";

import { fail, type ActionResult } from "@/lib/action-result";
import { lineStatus, type CartDetails, type CartLineDetail } from "@/lib/cart-details";
import { db } from "@/lib/db";
import { cartItemsSchema } from "@/lib/validators/cart";
import { t } from "@/lib/strings";
import { getFreeShippingThreshold } from "./storefront";

/**
 * PUBLIC action (guest cart): no auth, no caching, always a fresh DB read.
 * The client only sends {variantId, quantity}; names, prices and stock all come from the DB.
 * Exact stock is never returned above 10.
 */
export async function getCartDetails(items: unknown): Promise<ActionResult<CartDetails>> {
  const parsed = cartItemsSchema.safeParse(items);
  if (!parsed.success) return fail(t.shop.cart.invalidCart);

  const requested = parsed.data;
  const ids = [...new Set(requested.map((i) => i.variantId))];

  const [rows, freeShippingThreshold] = await Promise.all([
    ids.length === 0
      ? []
      : db.variant.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            label: true,
            price: true,
            compareAtPrice: true,
            stock: true,
            product: {
              select: {
                name: true,
                slug: true,
                isActive: true,
                images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        }),
    getFreeShippingThreshold(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines = requested.map((item): CartLineDetail => {
    const row = byId.get(item.variantId);
    if (!row || !row.product.isActive) return { variantId: item.variantId, status: "UNAVAILABLE" };
    const { status, availableQuantity } = lineStatus(item.quantity, row.stock);
    return {
      variantId: row.id,
      status,
      productName: row.product.name,
      productSlug: row.product.slug,
      variantLabel: row.label,
      imageUrl: row.product.images[0]?.url ?? null,
      unitPrice: row.price,
      compareAtPrice: row.compareAtPrice,
      availableQuantity,
    };
  });

  return { ok: true, lines, freeShippingThreshold };
}
