/** Result shapes shared by placeOrder (server) and the checkout UI (client). */

export type StockConflict = {
  variantId: string;
  /** Units still available, capped at 10 (the exact stock is never exposed above that). 0 = gone. */
  available: number;
};

export type PlaceOrderResult =
  | { ok: true; number: string; token: string }
  | {
      ok: false;
      error: string;
      code: "VALIDATION" | "STOCK_CONFLICT" | "RATE_LIMITED" | "UNEXPECTED";
      fieldErrors?: Record<string, string>;
      /** Only with STOCK_CONFLICT. */
      conflicts?: StockConflict[];
    };

export type OrderLineView = {
  productName: string;
  variantLabel: string;
  /** Millimes. */
  unitPrice: number;
  quantity: number;
};

/** Everything the confirmation page shows (token-protected, so it includes the address). */
export type ConfirmationOrder = {
  number: string;
  createdAt: Date;
  customerName: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string | null;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderLineView[];
};

export type TrackedOrder = {
  number: string;
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  /** ISO string (sent through a server action). */
  createdAt: string;
  governorate: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderLineView[];
};

export type TrackOrderResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; error: string; code: "NOT_FOUND" | "RATE_LIMITED" | "UNEXPECTED" };
