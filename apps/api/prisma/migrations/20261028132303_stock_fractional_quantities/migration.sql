-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "stock_quantity" SET DEFAULT 0,
ALTER COLUMN "stock_quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "stock_quantity" SET DEFAULT 0,
ALTER COLUMN "stock_quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "stock_adjustments" ALTER COLUMN "delta" SET DATA TYPE DOUBLE PRECISION;
