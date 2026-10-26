-- CreateTable
CREATE TABLE "funnel_recordings" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_recording_chunks" (
    "recording_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "events" JSONB NOT NULL,

    CONSTRAINT "funnel_recording_chunks_pkey" PRIMARY KEY ("recording_id","seq")
);

-- CreateIndex
CREATE INDEX "funnel_recordings_funnel_id_created_at_idx" ON "funnel_recordings"("funnel_id", "created_at");

-- CreateIndex
CREATE INDEX "funnel_recordings_created_at_idx" ON "funnel_recordings"("created_at");

-- AddForeignKey
ALTER TABLE "funnel_recordings" ADD CONSTRAINT "funnel_recordings_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_recording_chunks" ADD CONSTRAINT "funnel_recording_chunks_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "funnel_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
