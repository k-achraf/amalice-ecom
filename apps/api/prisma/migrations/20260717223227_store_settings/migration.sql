-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "active_template" TEXT NOT NULL DEFAULT 'minimal',
    "store_name" TEXT NOT NULL DEFAULT 'Amalice',
    "announcement_text" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);
