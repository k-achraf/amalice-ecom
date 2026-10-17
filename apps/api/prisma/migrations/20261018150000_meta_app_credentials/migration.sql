-- CreateTable
CREATE TABLE "meta_app_credentials" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "app_id" TEXT NOT NULL,
    "app_name" TEXT,
    "app_secret_enc" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_app_credentials_pkey" PRIMARY KEY ("id")
);
