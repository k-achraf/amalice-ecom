-- CreateEnum
CREATE TYPE "VideoCreativeStatus" AS ENUM ('Idea', 'Testing', 'Winner', 'Killed');

-- AlterTable
ALTER TABLE "sourced_product_video_creatives"
ADD COLUMN "name" TEXT,
ADD COLUMN "angle" TEXT,
ADD COLUMN "hook" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "status" "VideoCreativeStatus" NOT NULL DEFAULT 'Idea';
