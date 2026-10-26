-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "from_abandoned" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: carts still abandoned, and orders staff confirmed out of an abandoned cart
-- (their audit row says so). Orders the customer completed themselves were never recorded.
UPDATE "orders" SET "from_abandoned" = true WHERE "is_abandoned" = true;
UPDATE "orders" SET "from_abandoned" = true
WHERE "id" IN (
  SELECT "entity_id" FROM "audit_logs"
  WHERE "entity" = 'Order' AND ("metadata"->>'convertedFromAbandoned') = 'true'
);
