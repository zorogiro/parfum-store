/**
 * Pure pricing logic for the cart and checkout. No React or DB imports: the checkout
 * (server side, Task 7) reuses these functions to recompute totals.
 *
 * All amounts are integer millimes (1 TND = 1000 millimes).
 *
 * There are no discounts or coupons in the MVP, so the free-shipping threshold is compared
 * against the subtotal. If discounts are added later, decide whether the threshold applies
 * before or after the discount and update this file (and its tests) accordingly.
 */

export type PricedLine = { unitPrice: number; quantity: number };

function assertMillimes(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${value}`);
  }
}

/** A threshold of null or 0 means "free shipping disabled". Returns null when disabled. */
function activeThreshold(threshold: number | null): number | null {
  if (threshold === null) return null;
  assertMillimes(threshold, "freeShippingThreshold");
  return threshold === 0 ? null : threshold;
}

export function calculateSubtotal(lines: PricedLine[]): number {
  let subtotal = 0;
  for (const line of lines) {
    assertMillimes(line.unitPrice, "unitPrice");
    assertMillimes(line.quantity, "quantity");
    subtotal += line.unitPrice * line.quantity;
  }
  if (!Number.isSafeInteger(subtotal)) throw new Error("subtotal is too large");
  return subtotal;
}

export type ShippingInput = {
  subtotal: number;
  /** Flat fee of the destination governorate. */
  zoneFee: number;
  /** null or 0 = free shipping disabled. */
  freeShippingThreshold: number | null;
};

/** Empty cart (subtotal 0) = no shipping. Free once subtotal >= threshold (exactly met counts). */
export function calculateShippingFee({
  subtotal,
  zoneFee,
  freeShippingThreshold,
}: ShippingInput): number {
  assertMillimes(subtotal, "subtotal");
  assertMillimes(zoneFee, "zoneFee");
  const threshold = activeThreshold(freeShippingThreshold);
  if (subtotal === 0) return 0;
  if (threshold !== null && subtotal >= threshold) return 0;
  return zoneFee;
}

export function calculateTotal(input: ShippingInput): {
  subtotal: number;
  shippingFee: number;
  total: number;
} {
  const shippingFee = calculateShippingFee(input);
  return { subtotal: input.subtotal, shippingFee, total: input.subtotal + shippingFee };
}

/**
 * Millimes still missing to reach free shipping. null when the feature is disabled,
 * 0 when already reached.
 */
export function amountToFreeShipping(
  subtotal: number,
  freeShippingThreshold: number | null,
): number | null {
  assertMillimes(subtotal, "subtotal");
  const threshold = activeThreshold(freeShippingThreshold);
  if (threshold === null) return null;
  return Math.max(0, threshold - subtotal);
}
