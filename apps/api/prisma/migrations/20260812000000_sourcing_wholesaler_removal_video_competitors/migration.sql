-- DropForeignKey
ALTER TABLE "product_sourcing_requests" DROP CONSTRAINT "product_sourcing_requests_wholesaler_id_fkey";

-- DropIndex
DROP INDEX "product_sourcing_requests_wholesaler_id_idx";

-- AlterTable
ALTER TABLE "product_sourcing_requests" DROP COLUMN "wholesaler_id";

-- DropTable
DROP TABLE "wholesalers";

-- CreateTable
CREATE TABLE "sourced_product_video_creatives" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "AdTestPlatform",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourced_product_video_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourced_product_competitors" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "price_cents" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourced_product_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sourced_product_video_creatives_sourced_product_id_idx" ON "sourced_product_video_creatives"("sourced_product_id");

-- CreateIndex
CREATE INDEX "sourced_product_competitors_sourced_product_id_idx" ON "sourced_product_competitors"("sourced_product_id");

-- AddForeignKey
ALTER TABLE "sourced_product_video_creatives" ADD CONSTRAINT "sourced_product_video_creatives_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourced_product_competitors" ADD CONSTRAINT "sourced_product_competitors_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
