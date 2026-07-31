-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('Home', 'Desk');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipping_price_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipping_type" "ShippingType";

-- CreateTable
CREATE TABLE "wilaya_shipping_rates" (
    "id" TEXT NOT NULL,
    "wilaya_id" TEXT NOT NULL,
    "home_delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
    "home_delivery_price_cents" INTEGER,
    "desk_delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
    "desk_delivery_price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wilaya_shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wilaya_shipping_rates_wilaya_id_key" ON "wilaya_shipping_rates"("wilaya_id");

-- AddForeignKey
ALTER TABLE "wilaya_shipping_rates" ADD CONSTRAINT "wilaya_shipping_rates_wilaya_id_fkey" FOREIGN KEY ("wilaya_id") REFERENCES "wilayas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
