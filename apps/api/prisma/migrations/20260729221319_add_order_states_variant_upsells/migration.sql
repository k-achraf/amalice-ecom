-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderState" ADD VALUE 'WrongNumber';
ALTER TYPE "OrderState" ADD VALUE 'Postponed';
ALTER TYPE "OrderState" ADD VALUE 'OnHold';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "is_upsell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variant_id" TEXT;

-- CreateTable
CREATE TABLE "product_upsells" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "upsell_product_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "price_cents_override" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_upsells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_upsells_product_id_idx" ON "product_upsells"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_upsells_product_id_upsell_product_id_key" ON "product_upsells"("product_id", "upsell_product_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_upsells" ADD CONSTRAINT "product_upsells_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_upsells" ADD CONSTRAINT "product_upsells_upsell_product_id_fkey" FOREIGN KEY ("upsell_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
