-- AlterTable
ALTER TABLE "products" ADD COLUMN "key_benefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "faqs" JSONB;
ALTER TABLE "products" ADD COLUMN "specifications" JSONB;
