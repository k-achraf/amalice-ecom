-- CreateEnum
CREATE TYPE "FunnelStatus" AS ENUM ('Draft', 'Live', 'Paused');

-- CreateEnum
CREATE TYPE "FunnelStepType" AS ENUM ('Landing', 'OrderForm', 'OrderBump', 'Upsell', 'Downsell', 'ThankYou');

-- CreateTable
CREATE TABLE "funnels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "FunnelStatus" NOT NULL DEFAULT 'Draft',
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_steps" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "FunnelStepType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funnels_slug_key" ON "funnels"("slug");

-- CreateIndex
CREATE INDEX "funnels_product_id_idx" ON "funnels"("product_id");

-- CreateIndex
CREATE INDEX "funnels_status_idx" ON "funnels"("status");

-- CreateIndex
CREATE INDEX "funnel_steps_funnel_id_position_idx" ON "funnel_steps"("funnel_id", "position");

-- AddForeignKey
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
