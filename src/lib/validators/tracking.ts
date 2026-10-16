import { z } from "zod";

/** Order numbers look like ORD-000123 (see src/server/order-number.ts). */
export const ORDER_NUMBER_PATTERN = /^ORD-\d{1,12}$/;
/** base64url, 32-64 chars: matches tokens from generateTrackingToken and the migration backfill. */
export const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

/** Lenient on case and spacing: customers type "ord-123456 ". */
export const orderNumberSchema = z.string().trim().toUpperCase().regex(ORDER_NUMBER_PATTERN);

export const trackingTokenSchema = z.string().regex(TRACKING_TOKEN_PATTERN);

export const trackingLookupSchema = z.object({
  number: z.string().max(40),
  phone: z.string().max(40),
});
