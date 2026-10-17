-- CreateEnum
CREATE TYPE "AttributionPlatform" AS ENUM ('Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct');

-- CreateTable
CREATE TABLE "order_attributions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "platform" "AttributionPlatform" NOT NULL,
    "channel" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "campaign_id" TEXT,
    "adset_id" TEXT,
    "ad_id" TEXT,
    "campaign_name" TEXT,
    "adset_name" TEXT,
    "ad_name" TEXT,
    "placement" TEXT,
    "fbclid" TEXT,
    "ttclid" TEXT,
    "gclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "ttp" TEXT,
    "landing_url" TEXT,
    "referrer" TEXT,
    "page_url" TEXT,
    "visitor_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "first_touch" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_attributions_order_id_key" ON "order_attributions"("order_id");
CREATE INDEX "order_attributions_platform_created_at_idx" ON "order_attributions"("platform", "created_at");
CREATE INDEX "order_attributions_campaign_id_idx" ON "order_attributions"("campaign_id");
CREATE INDEX "order_attributions_utm_campaign_idx" ON "order_attributions"("utm_campaign");
CREATE INDEX "order_attributions_visitor_id_idx" ON "order_attributions"("visitor_id");

-- AddForeignKey
ALTER TABLE "order_attributions" ADD CONSTRAINT "order_attributions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
