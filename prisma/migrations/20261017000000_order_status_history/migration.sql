-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNote" TEXT;

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_toStatus_changedAt_idx" ON "OrderStatusHistory"("toStatus", "changedAt");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one row per existing order. The best available timestamp for "when the order reached
-- its current status" is updatedAt (equal to createdAt for orders never touched).
-- ids are generated here (cuid is a Prisma client feature): a prefixed md5 is unique and opaque.
INSERT INTO "OrderStatusHistory" ("id", "orderId", "fromStatus", "toStatus", "changedAt", "changedBy", "note")
SELECT 'bf' || md5(o."id" || 'status-history'), o."id", NULL, o."status", o."updatedAt", 'system', NULL
FROM "Order" o;
