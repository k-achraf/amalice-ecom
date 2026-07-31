-- CreateTable
CREATE TABLE "google_sheets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL DEFAULT 'Orders',
    "applies_to_all_products" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_google_sheets" (
    "product_id" TEXT NOT NULL,
    "google_sheet_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_google_sheets_pkey" PRIMARY KEY ("product_id","google_sheet_id")
);

-- CreateTable
CREATE TABLE "google_sheet_order_rows" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "google_sheet_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_sheet_order_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_google_sheets_google_sheet_id_idx" ON "product_google_sheets"("google_sheet_id");

-- CreateIndex
CREATE INDEX "google_sheet_order_rows_google_sheet_id_idx" ON "google_sheet_order_rows"("google_sheet_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_sheet_order_rows_order_id_google_sheet_id_key" ON "google_sheet_order_rows"("order_id", "google_sheet_id");

-- AddForeignKey
ALTER TABLE "product_google_sheets" ADD CONSTRAINT "product_google_sheets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_google_sheets" ADD CONSTRAINT "product_google_sheets_google_sheet_id_fkey" FOREIGN KEY ("google_sheet_id") REFERENCES "google_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_sheet_order_rows" ADD CONSTRAINT "google_sheet_order_rows_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_sheet_order_rows" ADD CONSTRAINT "google_sheet_order_rows_google_sheet_id_fkey" FOREIGN KEY ("google_sheet_id") REFERENCES "google_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
