-- CreateEnum
CREATE TYPE "ProductOfferType" AS ENUM ('FixedBundlePrice', 'BuyXGetYFree', 'FreeShipping');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "line_total_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offer_id" TEXT;

-- CreateTable
CREATE TABLE "product_offers" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "ProductOfferType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "required_quantity" INTEGER NOT NULL,
    "free_quantity" INTEGER NOT NULL DEFAULT 0,
    "bundle_price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_offers_product_id_idx" ON "product_offers"("product_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
