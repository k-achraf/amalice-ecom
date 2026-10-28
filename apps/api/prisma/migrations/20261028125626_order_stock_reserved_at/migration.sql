-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stock_reserved_at" TIMESTAMP(3);

-- Stock used to be taken when an order was CREATED; it is now taken when the order is CONFIRMED.
-- Orders that exist today already took their units at creation (abandoned carts never did, and
-- cancelled / restocked ones gave them back), so mark exactly those as holding stock.
UPDATE "orders"
SET "stock_reserved_at" = "created_at"
WHERE "is_abandoned" = false
  AND "state" NOT IN ('Cancelled', 'CancelledShipping', 'Restocked');
