-- Order.trackingToken (required, unique) and Order.idempotencyKey (optional, unique).
-- Add trackingToken as nullable first so existing rows can be backfilled with random tokens.
ALTER TABLE "Order" ADD COLUMN "trackingToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

-- Backfill: two random uuids concatenated without dashes (64 hex chars, ~244 random bits).
UPDATE "Order"
SET "trackingToken" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE "trackingToken" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET NOT NULL;

CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- Order.phone is already indexed ("Order_phone_idx"), nothing to add.
