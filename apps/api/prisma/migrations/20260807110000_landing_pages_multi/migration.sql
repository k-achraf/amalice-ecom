-- DropIndex: product_landing_pages was strictly one-per-product; a product
-- can now have multiple landing pages, addressed by /lp/:productSlug/:number
-- (never a raw id/slug/uuid in the URL).
ALTER TABLE "product_landing_pages" DROP CONSTRAINT IF EXISTS "product_landing_pages_product_id_key";

-- AlterTable
ALTER TABLE "product_landing_pages" ADD COLUMN "number" INTEGER;
ALTER TABLE "product_landing_pages" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Landing Page';

-- Backfill: number each pre-existing row sequentially per product (1, 2, 3,
-- ... ordered by creation), so no existing row is left without the new
-- required column.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "product_id" ORDER BY "created_at") AS rn
  FROM "product_landing_pages"
)
UPDATE "product_landing_pages" AS p
SET "number" = numbered.rn
FROM numbered
WHERE p."id" = numbered."id";

ALTER TABLE "product_landing_pages" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_landing_pages_product_id_number_key" ON "product_landing_pages"("product_id", "number");
