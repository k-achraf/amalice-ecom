-- CreateTable
CREATE TABLE "pixels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "server_events_enabled" BOOLEAN NOT NULL DEFAULT false,
    "access_token" TEXT,
    "test_event_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pixels_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "funnels" ADD COLUMN "pixel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "pixels_platform_idx" ON "pixels"("platform");

-- Carry over each funnel's own pixel: one named Pixel row per distinct id, reusing the store's access token.
INSERT INTO "pixels" ("id", "name", "platform", "pixel_id", "server_events_enabled", "access_token", "updated_at")
SELECT gen_random_uuid()::text, 'Meta ' || f.mid, 'Meta', f.mid,
       COALESCE((a.config->>'capiEnabled')::boolean, false), a.config->>'accessToken', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT meta_pixel_id AS mid FROM "funnels" WHERE meta_pixel_id IS NOT NULL) f
LEFT JOIN "app_installations" a ON a.app_id = 'meta-pixel';

INSERT INTO "pixels" ("id", "name", "platform", "pixel_id", "server_events_enabled", "access_token", "updated_at")
SELECT gen_random_uuid()::text, 'TikTok ' || f.tid, 'TikTok', f.tid,
       COALESCE((a.config->>'eapiEnabled')::boolean, false), a.config->>'accessToken', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT tiktok_pixel_code AS tid FROM "funnels" WHERE tiktok_pixel_code IS NOT NULL) f
LEFT JOIN "app_installations" a ON a.app_id = 'tiktok-pixel';

UPDATE "funnels" fn SET "pixel_ids" = ARRAY(
  SELECT p.id FROM "pixels" p
  WHERE (p.platform = 'Meta' AND p.pixel_id = fn.meta_pixel_id) OR (p.platform = 'TikTok' AND p.pixel_id = fn.tiktok_pixel_code)
);
