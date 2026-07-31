-- CreateEnum
CREATE TYPE "ShippingCompanyProvider" AS ENUM ('Dhd');

-- CreateTable
CREATE TABLE "shipping_companies" (
    "id" TEXT NOT NULL,
    "provider" "ShippingCompanyProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_token" TEXT,
    "is_linked" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_company_tariffs" (
    "id" TEXT NOT NULL,
    "shipping_company_id" TEXT NOT NULL,
    "wilaya_id" TEXT NOT NULL,
    "delivery_price_cents" INTEGER,
    "delivery_stopdesk_price_cents" INTEGER,
    "pickup_price_cents" INTEGER,
    "pickup_stopdesk_price_cents" INTEGER,
    "exchange_price_cents" INTEGER,
    "exchange_stopdesk_price_cents" INTEGER,
    "cod_fee_price_cents" INTEGER,
    "cod_fee_stopdesk_price_cents" INTEGER,
    "return_price_cents" INTEGER,
    "return_stopdesk_price_cents" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_company_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_companies_provider_key" ON "shipping_companies"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_company_tariffs_shipping_company_id_wilaya_id_key" ON "shipping_company_tariffs"("shipping_company_id", "wilaya_id");

-- AddForeignKey
ALTER TABLE "shipping_company_tariffs" ADD CONSTRAINT "shipping_company_tariffs_shipping_company_id_fkey" FOREIGN KEY ("shipping_company_id") REFERENCES "shipping_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_company_tariffs" ADD CONSTRAINT "shipping_company_tariffs_wilaya_id_fkey" FOREIGN KEY ("wilaya_id") REFERENCES "wilayas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
