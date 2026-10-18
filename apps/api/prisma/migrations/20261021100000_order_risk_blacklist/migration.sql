-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "BlacklistType" AS ENUM ('Phone', 'Address');

-- CreateEnum
CREATE TYPE "BlacklistAction" AS ENUM ('Warn', 'Block');

-- CreateEnum
CREATE TYPE "BlacklistSource" AS ENUM ('Manual', 'Auto');

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "risk_score" INTEGER,
  ADD COLUMN "risk_level" "RiskLevel",
  ADD COLUMN "risk_factors" JSONB;

-- CreateTable
CREATE TABLE "blacklist_entries" (
    "id" TEXT NOT NULL,
    "type" "BlacklistType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "action" "BlacklistAction" NOT NULL,
    "source" "BlacklistSource" NOT NULL DEFAULT 'Manual',
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blacklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_risk_level_idx" ON "orders"("risk_level");

-- CreateIndex
CREATE INDEX "blacklist_entries_active_type_idx" ON "blacklist_entries"("active", "type");

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_entries_type_value_key" ON "blacklist_entries"("type", "value");
