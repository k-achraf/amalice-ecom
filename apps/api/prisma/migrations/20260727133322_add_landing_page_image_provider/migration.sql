-- CreateEnum
CREATE TYPE "LandingPageImageProvider" AS ENUM ('Gemini', 'Pollinations');

-- AlterTable
ALTER TABLE "product_landing_pages" ADD COLUMN     "image_provider" "LandingPageImageProvider" NOT NULL DEFAULT 'Gemini';
