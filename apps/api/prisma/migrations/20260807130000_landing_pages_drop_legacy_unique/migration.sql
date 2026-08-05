-- Follow-up to 20260807110000_landing_pages_multi and
-- 20260807120000_landing_pages_number. Both of those included
-- `ALTER TABLE "product_landing_pages" DROP CONSTRAINT IF EXISTS
-- "product_landing_pages_product_id_key"` as their first statement, and
-- both times it silently no-op'd on the real environment — confirmed via
-- `\d product_landing_pages`: the object is a plain UNIQUE INDEX, not a
-- table CONSTRAINT (i.e. it was originally created via `CREATE UNIQUE
-- INDEX ...` rather than `ADD CONSTRAINT ... UNIQUE`). `DROP CONSTRAINT`
-- only matches Postgres's constraint catalog (pg_constraint); a plain
-- index by the same conventional name was never in there, so `IF EXISTS`
-- was true to its word — there was never a matching CONSTRAINT to drop.
--
-- This is why generating a second landing page for the same product failed
-- with "Unique constraint failed on the fields: (product_id)" even after
-- product_landing_pages_product_id_number_key (the correct compound
-- constraint) was successfully created — the old single-column index was
-- still enforcing "one row per product" independently of it.
--
-- This migration checks pg_constraint AND pg_class so it drops the object
-- correctly regardless of which form it turns out to be in a given
-- environment, instead of guessing a third time.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_landing_pages_product_id_key'
  ) THEN
    ALTER TABLE "product_landing_pages" DROP CONSTRAINT "product_landing_pages_product_id_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'product_landing_pages_product_id_key' AND relkind = 'i'
  ) THEN
    DROP INDEX "product_landing_pages_product_id_key";
  END IF;
END $$;
