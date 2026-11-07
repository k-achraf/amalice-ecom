-- AlterTable
ALTER TABLE "funnels" ADD COLUMN     "protection" JSONB;

-- CreateTable
CREATE TABLE "funnel_blocked_attempts" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "phone" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_blocked_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_blocked_attempts_funnel_id_created_at_idx" ON "funnel_blocked_attempts"("funnel_id", "created_at");

-- AddForeignKey
ALTER TABLE "funnel_blocked_attempts" ADD CONSTRAINT "funnel_blocked_attempts_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
