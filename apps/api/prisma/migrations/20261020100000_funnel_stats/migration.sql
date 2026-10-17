-- AlterTable
ALTER TABLE "orders" ADD COLUMN "funnel_id" TEXT;

-- AlterTable
ALTER TABLE "page_view_events"
  ADD COLUMN "duration_seconds" INTEGER,
  ADD COLUMN "scroll_depth" INTEGER,
  ADD COLUMN "started_form" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "device_type" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "campaign" TEXT;

-- CreateIndex
CREATE INDEX "orders_funnel_id_idx" ON "orders"("funnel_id");
CREATE INDEX "page_view_events_entity_id_created_at_idx" ON "page_view_events"("entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing funnel orders are recognised by the funnel page they were submitted from (/f/<slug>).
UPDATE "orders" o
SET "funnel_id" = f."id"
FROM "order_attributions" a, "funnels" f
WHERE a."order_id" = o."id"
  AND a."channel" = 'funnel'
  AND a."page_url" ~ ('/f/' || f."slug" || '([/?#]|$)');
