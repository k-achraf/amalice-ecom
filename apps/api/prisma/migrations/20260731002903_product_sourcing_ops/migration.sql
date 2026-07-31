-- CreateEnum
CREATE TYPE "SourcedProductStatus" AS ENUM ('Researching', 'Testing', 'TestPassed', 'TestFailed', 'Sourcing', 'Received', 'Live', 'Discontinued');

-- CreateEnum
CREATE TYPE "AdTestPlatform" AS ENUM ('Facebook', 'TikTok', 'Snapchat', 'Google', 'Other');

-- CreateEnum
CREATE TYPE "AdCreativeType" AS ENUM ('Image', 'Video');

-- CreateEnum
CREATE TYPE "AdTestStatus" AS ENUM ('Running', 'Passed', 'Failed');

-- CreateEnum
CREATE TYPE "SourcingRequestStatus" AS ENUM ('Requested', 'Confirmed', 'Shipped', 'Received', 'Cancelled');

-- CreateTable
CREATE TABLE "sourced_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_url" TEXT,
    "image_url" TEXT,
    "niche" TEXT,
    "notes" TEXT,
    "status" "SourcedProductStatus" NOT NULL DEFAULT 'Researching',
    "linked_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourced_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ad_tests" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "platform" "AdTestPlatform" NOT NULL DEFAULT 'Other',
    "price_cents" INTEGER NOT NULL,
    "creative_type" "AdCreativeType",
    "creative_url" TEXT,
    "ad_spend_cents" INTEGER NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "revenue_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "AdTestStatus" NOT NULL DEFAULT 'Running',
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_ad_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesalers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesalers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sourcing_requests" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "wholesaler_id" TEXT NOT NULL,
    "requested_quantity" INTEGER NOT NULL,
    "requested_country" TEXT NOT NULL,
    "unit_cost_cents" INTEGER,
    "status" "SourcingRequestStatus" NOT NULL DEFAULT 'Requested',
    "notes" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_sourcing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sourced_products_linked_product_id_key" ON "sourced_products"("linked_product_id");

-- CreateIndex
CREATE INDEX "sourced_products_status_idx" ON "sourced_products"("status");

-- CreateIndex
CREATE INDEX "product_ad_tests_sourced_product_id_idx" ON "product_ad_tests"("sourced_product_id");

-- CreateIndex
CREATE INDEX "product_sourcing_requests_sourced_product_id_idx" ON "product_sourcing_requests"("sourced_product_id");

-- CreateIndex
CREATE INDEX "product_sourcing_requests_wholesaler_id_idx" ON "product_sourcing_requests"("wholesaler_id");

-- AddForeignKey
ALTER TABLE "sourced_products" ADD CONSTRAINT "sourced_products_linked_product_id_fkey" FOREIGN KEY ("linked_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ad_tests" ADD CONSTRAINT "product_ad_tests_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sourcing_requests" ADD CONSTRAINT "product_sourcing_requests_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sourcing_requests" ADD CONSTRAINT "product_sourcing_requests_wholesaler_id_fkey" FOREIGN KEY ("wholesaler_id") REFERENCES "wholesalers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
