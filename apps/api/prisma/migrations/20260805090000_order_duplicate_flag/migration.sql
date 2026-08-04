-- AlterTable
ALTER TABLE "orders" ADD COLUMN "is_duplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "duplicate_of_order_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_duplicate_of_order_id_idx" ON "orders"("duplicate_of_order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_duplicate_of_order_id_fkey" FOREIGN KEY ("duplicate_of_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
