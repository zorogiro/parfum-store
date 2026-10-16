import { z } from "zod";

/** Limits shared by the client cart and the public getCartDetails action. */
export const CART_MAX_QUANTITY = 10;
export const CART_MAX_LINES = 20;

/** Variant ids are cuids; accept any short URL-safe token so a format change doesn't break carts. */
export const variantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const cartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: z.number().int().min(1).max(CART_MAX_QUANTITY),
});

export const cartItemsSchema = z.array(cartItemSchema).max(CART_MAX_LINES);

export type CartItem = z.infer<typeof cartItemSchema>;
