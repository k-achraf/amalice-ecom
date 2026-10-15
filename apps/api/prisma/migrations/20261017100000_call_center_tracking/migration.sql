-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('Confirmed', 'NoAnswer', 'WrongNumber', 'Postponed', 'Cancelled');

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "assigned_to_id" TEXT,
  ADD COLUMN "assigned_to_email" TEXT,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "skipped_until" TIMESTAMP(3),
  ADD COLUMN "call_attempts_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_called_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "call_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "agent_email" TEXT,
    "outcome" "CallOutcome" NOT NULL,
    "from_state" "OrderState" NOT NULL,
    "to_state" "OrderState" NOT NULL,
    "note" TEXT,
    "reason" TEXT,
    "postponed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_attempts_order_id_idx" ON "call_attempts"("order_id");
CREATE INDEX "call_attempts_agent_id_created_at_idx" ON "call_attempts"("agent_id", "created_at");
CREATE INDEX "call_attempts_created_at_idx" ON "call_attempts"("created_at");

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
