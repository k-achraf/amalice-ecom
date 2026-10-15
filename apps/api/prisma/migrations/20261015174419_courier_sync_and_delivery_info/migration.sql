-- CreateEnum
CREATE TYPE "CourierOperation" AS ENUM ('Delivery', 'Exchange');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courier_operation" "CourierOperation" NOT NULL DEFAULT 'Delivery',
ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "exchange_product" TEXT,
ADD COLUMN     "gps_link" TEXT,
ADD COLUMN     "is_fragile" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "activity" JSONB,
ADD COLUMN     "carrier_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "carrier_fee_cents" INTEGER,
ADD COLUMN     "desk_info" JSONB,
ADD COLUMN     "last_failure_reason" TEXT,
ADD COLUMN     "last_synced_at" TIMESTAMP(3),
ADD COLUMN     "postponed_to" TIMESTAMP(3),
ADD COLUMN     "return_fee_cents" INTEGER;

-- AlterTable
ALTER TABLE "shipping_companies" ADD COLUMN     "locations_synced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "shipping_company_communes" (
    "id" TEXT NOT NULL,
    "shipping_company_id" TEXT NOT NULL,
    "wilaya_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postal_code" TEXT,
    "has_stop_desk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shipping_company_communes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_company_communes_shipping_company_id_wilaya_id_idx" ON "shipping_company_communes"("shipping_company_id", "wilaya_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_company_communes_shipping_company_id_wilaya_id_nam_key" ON "shipping_company_communes"("shipping_company_id", "wilaya_id", "name");

-- AddForeignKey
ALTER TABLE "shipping_company_communes" ADD CONSTRAINT "shipping_company_communes_shipping_company_id_fkey" FOREIGN KEY ("shipping_company_id") REFERENCES "shipping_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
