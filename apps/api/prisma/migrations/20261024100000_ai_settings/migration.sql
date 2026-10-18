-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "provider" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "key_hint" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "fast_provider" TEXT,
    "fast_model" TEXT,
    "smart_provider" TEXT,
    "smart_model" TEXT,
    "fallback_provider" TEXT,
    "fallback_model" TEXT,
    "daily_call_limit" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
