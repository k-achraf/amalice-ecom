-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockAdjustmentReason" ADD VALUE 'Release';
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'Stocktake';

-- AlterTable
ALTER TABLE "stock_adjustments" ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "supplier_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_adjustments_variant_id_idx" ON "stock_adjustments"("variant_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_order_id_idx" ON "stock_adjustments"("order_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_supplier_id_idx" ON "stock_adjustments"("supplier_id");

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
