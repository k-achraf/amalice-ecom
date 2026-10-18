-- AlterTable
ALTER TABLE "orders" ADD COLUMN "delivered_event_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_state_delivered_event_sent_at_idx" ON "orders"("state", "delivered_event_sent_at");

-- CreateTable
CREATE TABLE "report_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "telegram_bot_token" TEXT,
    "telegram_chat_id" TEXT,
    "daily_report_hour" INTEGER NOT NULL DEFAULT 21,
    "max_cost_per_order_dzd" INTEGER,
    "return_rate_alert_pct" INTEGER NOT NULL DEFAULT 40,
    "return_rate_min_orders" INTEGER NOT NULL DEFAULT 8,
    "carrier_stale_hours" INTEGER NOT NULL DEFAULT 36,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("key")
);

-- Orders delivered before this feature must not be replayed to the ad platforms.
UPDATE "orders" SET "delivered_event_sent_at" = NOW() WHERE "state" IN ('Delivered', 'CashCollected', 'Reconciled', 'Settled');
