-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('Pending', 'Generating', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "product_landing_pages" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'Pending',
    "final_image_url" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_landing_pages_product_id_key" ON "product_landing_pages"("product_id");

-- AddForeignKey
ALTER TABLE "product_landing_pages" ADD CONSTRAINT "product_landing_pages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
