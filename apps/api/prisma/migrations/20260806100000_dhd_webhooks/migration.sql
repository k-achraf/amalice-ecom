-- AlterTable: shipping_companies (webhook secret)
ALTER TABLE "shipping_companies" ADD COLUMN "webhook_secret" TEXT;

-- AlterTable: shipments (driver details from courier webhooks)
ALTER TABLE "shipments" ADD COLUMN "driver_name" TEXT;
ALTER TABLE "shipments" ADD COLUMN "driver_phone" TEXT;

-- CreateTable
CREATE TABLE "courier_webhook_events" (
    "id" TEXT NOT NULL,
    "shipping_company_id" TEXT NOT NULL,
    "tracking_reference" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "state_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "order_id" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_webhook_events_shipping_company_id_tracking_refer_key" ON "courier_webhook_events"("shipping_company_id", "tracking_reference", "event");

-- CreateIndex
CREATE INDEX "courier_webhook_events_tracking_reference_idx" ON "courier_webhook_events"("tracking_reference");

-- CreateIndex
CREATE INDEX "courier_webhook_events_order_id_idx" ON "courier_webhook_events"("order_id");

-- AddForeignKey
ALTER TABLE "courier_webhook_events" ADD CONSTRAINT "courier_webhook_events_shipping_company_id_fkey" FOREIGN KEY ("shipping_company_id") REFERENCES "shipping_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_webhook_events" ADD CONSTRAINT "courier_webhook_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
