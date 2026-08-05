-- Follow-up to 20260807110000_landing_pages_multi. That migration's file
-- content was edited mid-session (slug-based URLs -> numbered URLs) AFTER
-- it had already been deployed with the old slug-based SQL — a real
-- environment already recorded it as applied with the old content, so
-- editing it again would just diverge further from what's actually on disk.
-- This migration instead brings that environment's actual table (still has
-- `slug`/`name` columns and the old single-column `product_id` unique
-- constraint — the DROP CONSTRAINT never ran either) in line with the
-- current schema.prisma, which uses `number` (sequential per product) in
-- place of `slug` for the /lp/:productSlug/:number URL. Every statement is
-- defensive (IF EXISTS / guarded) so this is safe to run whether or not a
-- given environment already has any of the old-vs-new column state.

-- DropIndex: the original strictly-one-per-product constraint, if a given
-- environment's earlier migration never actually dropped it.
ALTER TABLE "product_landing_pages" DROP CONSTRAINT IF EXISTS "product_landing_pages_product_id_key";

-- AddColumn
ALTER TABLE "product_landing_pages" ADD COLUMN IF NOT EXISTS "number" INTEGER;

-- Backfill: number each row sequentially per product (1, 2, 3, ... ordered
-- by creation) — covers both a fully-fresh table and one that already has
-- rows from the slug-based version.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "product_id" ORDER BY "created_at") AS rn
  FROM "product_landing_pages"
)
UPDATE "product_landing_pages" AS p
SET "number" = numbered.rn
FROM numbered
WHERE p."id" = numbered."id" AND p."number" IS NULL;

ALTER TABLE "product_landing_pages" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_landing_pages_product_id_number_key" ON "product_landing_pages"("product_id", "number");

-- DropIndex + DropColumn: `slug` is no longer part of the schema — the
-- public URL is /lp/:productSlug/:number now, derived from Product.slug +
-- ProductLandingPage.number, not a slug of its own.
DROP INDEX IF EXISTS "product_landing_pages_slug_key";
ALTER TABLE "product_landing_pages" DROP COLUMN IF EXISTS "slug";
