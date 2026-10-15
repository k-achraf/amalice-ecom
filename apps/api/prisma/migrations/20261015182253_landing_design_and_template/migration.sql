-- AlterEnum
ALTER TYPE "LandingPageImageProvider" ADD VALUE 'Template';

-- AlterTable
ALTER TABLE "product_landing_pages" ADD COLUMN     "design" JSONB NOT NULL DEFAULT '{}';
