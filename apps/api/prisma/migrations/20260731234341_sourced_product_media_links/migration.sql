-- CreateEnum
CREATE TYPE "SourcedProductMediaType" AS ENUM ('Image', 'Video');

-- CreateTable
CREATE TABLE "sourced_product_media" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "type" "SourcedProductMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourced_product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourced_product_links" (
    "id" TEXT NOT NULL,
    "sourced_product_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourced_product_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sourced_product_media_sourced_product_id_idx" ON "sourced_product_media"("sourced_product_id");

-- CreateIndex
CREATE INDEX "sourced_product_links_sourced_product_id_idx" ON "sourced_product_links"("sourced_product_id");

-- AddForeignKey
ALTER TABLE "sourced_product_media" ADD CONSTRAINT "sourced_product_media_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourced_product_links" ADD CONSTRAINT "sourced_product_links_sourced_product_id_fkey" FOREIGN KEY ("sourced_product_id") REFERENCES "sourced_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
