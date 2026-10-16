"use server";

import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { PlaceOrderResult, StockConflict } from "@/lib/checkout-types";
import { parseThresholdSetting } from "@/lib/cart-details";
import { db } from "@/lib/db";
import { calculateSubtotal, calculateTotal } from "@/lib/pricing";
import { t } from "@/lib/strings";
import { checkoutSchema, toFieldErrors } from "@/lib/validators/checkout";
import { CART_MAX_QUANTITY } from "@/lib/validators/cart";
import { MAX_QUANTITY } from "@/lib/product-variants";
import { revalidateStock } from "./catalog-utils";
import { checkoutFailureLimiter, orderIpLimiter, orderPhoneLimiter } from "./checkout-limits";
import { sendOrderEmails } from "./email";
import { nextOrderNumber } from "./order-number";
import { generateTrackingToken } from "./order-token";
import { getClientIp } from "./request-ip";

const e = t.shop.checkout.errors;

/** Thrown inside the transaction to roll it back and report a stock problem. */
class StockConflictError extends Error {
  constructor(readonly conflicts: StockConflict[]) {
    super("STOCK_CONFLICT");
  }
}

/** Thrown inside the transaction when the governorate has no ShippingZone. */
class UnknownGovernorateError extends Error {}

type CreatedOrder = { number: string; token: string; created: boolean };

const generic = (): PlaceOrderResult => ({
  ok: false,
  code: "UNEXPECTED",
  error: e.unexpected,
});

/** Never log personal data or driver messages (they can echo values): only the error kind. */
function logError(where: string, error: unknown) {
  const name = error instanceof Error ? error.name : "unknown";
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? ` ${error.code}` : "";
  console.error(`[checkout] ${where} failed (${name}${code})`);
}

function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  return `${JSON.stringify(error.meta ?? {})} ${error.message}`.toLowerCase().includes(column);
}

/**
 * PUBLIC action (guest checkout, cash on delivery). The browser sends only contact details,
 * the governorate name and {variantId, quantity} lines: prices, shipping and totals are
 * recomputed here from the database with src/lib/pricing.ts.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const ip = await getClientIp();

  if (await checkoutFailureLimiter.isBlocked(`ip:${ip}`)) {
    return { ok: false, code: "RATE_LIMITED", error: e.rateLimited };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
    return {
      ok: false,
      code: "VALIDATION",
      error: e.invalidForm,
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const data = parsed.data;

  // Honeypot: a bot filled the hidden field. Answer with the same generic error as any
  // unexpected failure so it learns nothing, and create nothing.
  if (data.website) {
    await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
    return generic();
  }

  // Merge duplicate lines (a hand-built payload could repeat a variant) and re-check the cap.
  const wanted = new Map<string, number>();
  for (const item of data.items) {
    wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity);
  }
  if ([...wanted.values()].some((q) => q > CART_MAX_QUANTITY)) {
    await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
    return { ok: false, code: "VALIDATION", error: e.items, fieldErrors: { items: e.items } };
  }

  // A retry of an order that already exists is answered before any rate limiting, so a
  // double click or a network retry never fails with "too many orders".
  try {
    const existing = await db.order.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: { number: true, trackingToken: true },
    });
    if (existing) return { ok: true, number: existing.number, token: existing.trackingToken };
  } catch (error) {
    logError("idempotency lookup", error);
    return generic();
  }

  if (
    (await orderIpLimiter.isBlocked(`ip:${ip}`)) ||
    (await orderPhoneLimiter.isBlocked(`phone:${data.phone}`))
  ) {
    return { ok: false, code: "RATE_LIMITED", error: e.rateLimited };
  }

  let result: CreatedOrder;
  try {
    result = await createOrder(data, wanted);
  } catch (error) {
    if (error instanceof StockConflictError) {
      await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
      return {
        ok: false,
        code: "STOCK_CONFLICT",
        error: e.stockConflict,
        conflicts: error.conflicts,
      };
    }
    if (error instanceof UnknownGovernorateError) {
      await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
      return {
        ok: false,
        code: "VALIDATION",
        error: e.invalidForm,
        fieldErrors: { governorate: e.governorate },
      };
    }
    // Two requests with the same idempotency key raced past the lookup: the loser hits the
    // unique constraint (its transaction, including the stock decrement, is rolled back).
    if (isUniqueViolationOn(error, "idempotencykey")) {
      try {
        const existing = await db.order.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          select: { number: true, trackingToken: true },
        });
        if (existing) return { ok: true, number: existing.number, token: existing.trackingToken };
      } catch (lookupError) {
        logError("idempotency recovery", lookupError);
      }
    }
    logError("placeOrder", error);
    await checkoutFailureLimiter.recordFailure(`ip:${ip}`);
    return generic();
  }

  if (!result.created) {
    return { ok: true, number: result.number, token: result.token };
  }

  await orderIpLimiter.recordFailure(`ip:${ip}`);
  await orderPhoneLimiter.recordFailure(`phone:${data.phone}`);

  // Stock changed: refresh the "Épuisé" badges and the in-stock filter.
  revalidateStock();

  return { ok: true, number: result.number, token: result.token };
}

type CheckoutData = ReturnType<typeof checkoutSchema.parse>;

async function createOrder(data: CheckoutData, wanted: Map<string, number>): Promise<CreatedOrder> {
  // Sorted ids give every concurrent order the same lock order for the stock updates.
  const variantIds = [...wanted.keys()].sort();

  const outcome = await db.$transaction(
    async (tx) => {
      // Serialize retries of the same checkout attempt: the second one waits here, then finds
      // the order created by the first one instead of colliding with it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.idempotencyKey}))`;
      const existing = await tx.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: { number: true, trackingToken: true },
      });
      if (existing) {
        return { number: existing.number, token: existing.trackingToken, created: false } as const;
      }

      // Sequential on purpose: a transaction owns a single connection, and pg deprecates
      // issuing concurrent queries on one client.
      const variants = await tx.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          label: true,
          price: true,
          stock: true,
          product: { select: { name: true, isActive: true } },
        },
      });
      const zone = await tx.shippingZone.findUnique({ where: { governorate: data.governorate } });
      const thresholdSetting = await tx.setting.findUnique({
        where: { key: "freeShippingThreshold" },
      });
      if (!zone) throw new UnknownGovernorateError();

      const byId = new Map(variants.map((v) => [v.id, v]));
      const conflicts: StockConflict[] = [];
      for (const id of variantIds) {
        const variant = byId.get(id);
        const quantity = wanted.get(id)!;
        if (!variant || !variant.product.isActive) {
          conflicts.push({ variantId: id, available: 0 });
        } else if (variant.stock < quantity) {
          conflicts.push({
            variantId: id,
            available: Math.max(0, Math.min(variant.stock, MAX_QUANTITY)),
          });
        }
      }
      if (conflicts.length > 0) throw new StockConflictError(conflicts);

      // The conditional UPDATE is what makes concurrent orders safe: the row lock makes a
      // second order wait, then re-evaluate `stock >= quantity` against the committed value.
      const lost: string[] = [];
      for (const id of variantIds) {
        const { count } = await tx.variant.updateMany({
          where: { id, stock: { gte: wanted.get(id)! } },
          data: { stock: { decrement: wanted.get(id)! } },
        });
        if (count !== 1) lost.push(id);
      }
      if (lost.length > 0) {
        const fresh = await tx.variant.findMany({
          where: { id: { in: lost } },
          select: { id: true, stock: true },
        });
        const stockById = new Map(fresh.map((v) => [v.id, v.stock]));
        throw new StockConflictError(
          lost.map((id) => ({
            variantId: id,
            available: Math.max(0, Math.min(stockById.get(id) ?? 0, MAX_QUANTITY)),
          })),
        );
      }

      const lines = variantIds.map((id) => {
        const variant = byId.get(id)!;
        return {
          variantId: id,
          productName: variant.product.name,
          variantLabel: variant.label,
          unitPrice: variant.price,
          quantity: wanted.get(id)!,
        };
      });
      const { subtotal, shippingFee, total } = calculateTotal({
        subtotal: calculateSubtotal(lines),
        zoneFee: zone.fee,
        freeShippingThreshold: parseThresholdSetting(thresholdSetting?.value),
      });

      const token = generateTrackingToken();
      const order = await tx.order.create({
        data: {
          number: await nextOrderNumber(tx),
          trackingToken: token,
          idempotencyKey: data.idempotencyKey,
          status: "PENDING",
          customerName: data.customerName,
          phone: data.phone,
          email: data.email ?? null,
          governorate: zone.governorate,
          city: data.city,
          address: data.address,
          notes: data.notes ?? null,
          subtotal,
          shippingFee,
          total,
          items: { create: lines },
          // First history row, in the same transaction as the order.
          statusHistory: { create: { fromStatus: null, toStatus: "PENDING", changedBy: "system" } },
        },
        select: { number: true },
      });

      return {
        number: order.number,
        token,
        created: true,
        email: {
          number: order.number,
          customerName: data.customerName,
          phone: data.phone,
          email: data.email,
          governorate: zone.governorate,
          city: data.city,
          address: data.address,
          notes: data.notes,
          items: lines.map(({ productName, variantLabel, unitPrice, quantity }) => ({
            productName,
            variantLabel,
            unitPrice,
            quantity,
          })),
          subtotal,
          shippingFee,
          total,
        },
      } as const;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  if (outcome.created) {
    // After the response: an email problem (or a slow provider) never affects the order.
    after(() => sendOrderEmails(outcome.email));
  }
  return { number: outcome.number, token: outcome.token, created: outcome.created };
}
