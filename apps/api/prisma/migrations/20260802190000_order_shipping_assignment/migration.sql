-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('Unassigned', 'ShippingCompany', 'Manual');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfillment_method" "FulfillmentMethod" NOT NULL DEFAULT 'Unassigned',
ADD COLUMN     "shipping_company_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_shipping_company_id_idx" ON "orders"("shipping_company_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_company_id_fkey" FOREIGN KEY ("shipping_company_id") REFERENCES "shipping_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
