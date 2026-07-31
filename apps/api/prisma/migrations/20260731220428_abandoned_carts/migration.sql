-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "is_abandoned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "abandoned_cart_delay_seconds" INTEGER NOT NULL DEFAULT 60;
