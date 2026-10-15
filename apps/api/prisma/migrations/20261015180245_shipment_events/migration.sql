-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "station" TEXT,
    "driver" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_events_order_id_occurred_at_idx" ON "shipment_events"("order_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_events_shipment_id_dedup_key_key" ON "shipment_events"("shipment_id", "dedup_key");

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
