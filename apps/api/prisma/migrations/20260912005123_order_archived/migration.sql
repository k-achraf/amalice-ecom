-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_archived_idx" ON "orders"("archived");

-- RenameIndex
ALTER INDEX "courier_webhook_events_shipping_company_id_tracking_refer_key" RENAME TO "courier_webhook_events_shipping_company_id_tracking_referen_key";
