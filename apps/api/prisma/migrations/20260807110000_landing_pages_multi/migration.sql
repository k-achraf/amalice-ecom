-- DropIndex: product_landing_pages was strictly one-per-product; a product
-- can now have multiple landing pages.
ALTER TABLE "product_landing_pages" DROP CONSTRAINT IF EXISTS "product_landing_pages_product_id_key";

-- AlterTable
ALTER TABLE "product_landing_pages" ADD COLUMN "slug" TEXT;
ALTER TABLE "product_landing_pages" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Landing Page';

-- Backfill: any pre-existing row gets its own id as a placeholder slug
-- (guaranteed unique) so the NOT NULL + UNIQUE constraint below can be
-- applied safely without a product join. Fine for pre-existing draft data;
-- newly generated pages get a real product-slug-derived value.
UPDATE "product_landing_pages" SET "slug" = "id" WHERE "slug" IS NULL;

ALTER TABLE "product_landing_pages" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_landing_pages_slug_key" ON "product_landing_pages"("slug");
