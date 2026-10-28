-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courier_commune" TEXT,
ADD COLUMN     "courier_location_company_id" TEXT,
ADD COLUMN     "courier_postal_code" TEXT,
ADD COLUMN     "courier_wilaya_id" TEXT;

-- CreateTable
CREATE TABLE "shipping_company_location_maps" (
    "id" TEXT NOT NULL,
    "shipping_company_id" TEXT NOT NULL,
    "our_wilaya_id" TEXT NOT NULL,
    "our_commune" TEXT NOT NULL DEFAULT '',
    "courier_wilaya_id" TEXT NOT NULL,
    "courier_commune" TEXT,
    "courier_postal_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_company_location_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_company_location_maps_shipping_company_id_our_wila_key" ON "shipping_company_location_maps"("shipping_company_id", "our_wilaya_id", "our_commune");

-- AddForeignKey
ALTER TABLE "shipping_company_location_maps" ADD CONSTRAINT "shipping_company_location_maps_shipping_company_id_fkey" FOREIGN KEY ("shipping_company_id") REFERENCES "shipping_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
