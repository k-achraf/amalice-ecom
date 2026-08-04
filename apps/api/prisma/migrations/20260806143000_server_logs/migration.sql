-- CreateEnum
CREATE TYPE "ServerLogLevel" AS ENUM ('Warn', 'Error');

-- CreateTable
CREATE TABLE "server_logs" (
    "id" TEXT NOT NULL,
    "level" "ServerLogLevel" NOT NULL,
    "context" TEXT,
    "message" TEXT NOT NULL,
    "trace" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_logs_level_idx" ON "server_logs"("level");

-- CreateIndex
CREATE INDEX "server_logs_created_at_idx" ON "server_logs"("created_at");
