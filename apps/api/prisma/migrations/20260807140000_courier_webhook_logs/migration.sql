-- CreateTable
CREATE TABLE "courier_webhook_logs" (
    "id" TEXT NOT NULL,
    "shipping_company_id" TEXT,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "raw_body" TEXT,
    "signature_header" TEXT,
    "signature_valid" BOOLEAN,
    "status_code" INTEGER NOT NULL,
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courier_webhook_logs_shipping_company_id_idx" ON "courier_webhook_logs"("shipping_company_id");

-- CreateIndex
CREATE INDEX "courier_webhook_logs_received_at_idx" ON "courier_webhook_logs"("received_at");
