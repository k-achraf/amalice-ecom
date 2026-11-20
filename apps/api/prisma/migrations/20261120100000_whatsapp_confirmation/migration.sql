-- CreateEnum
CREATE TYPE "WhatsappStatus" AS ENUM ('Sent', 'Failed', 'Confirmed', 'Cancelled');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "whatsapp_status" "WhatsappStatus",
ADD COLUMN "whatsapp_sent_at" TIMESTAMP(3),
ADD COLUMN "whatsapp_responded_at" TIMESTAMP(3),
ADD COLUMN "whatsapp_message_id" TEXT,
ADD COLUMN "whatsapp_error" TEXT;

-- CreateIndex
CREATE INDEX "orders_whatsapp_message_id_idx" ON "orders"("whatsapp_message_id");
