-- CreateEnum
CREATE TYPE "PageViewType" AS ENUM ('Home', 'Product', 'LandingPage', 'Other');

-- CreateTable
CREATE TABLE "page_view_events" (
    "id" TEXT NOT NULL,
    "type" "PageViewType" NOT NULL,
    "entity_id" TEXT,
    "visitor_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_view_events_type_created_at_idx" ON "page_view_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "page_view_events_entity_id_idx" ON "page_view_events"("entity_id");

-- CreateIndex
CREATE INDEX "page_view_events_visitor_id_idx" ON "page_view_events"("visitor_id");
