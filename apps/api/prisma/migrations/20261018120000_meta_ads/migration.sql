-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('Active', 'Expired');

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "fb_user_id" TEXT NOT NULL,
    "fb_user_name" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "scopes" TEXT[],
    "token_expires_at" TIMESTAMP(3),
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'Active',
    "selected_ad_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_accounts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "timezone_name" TEXT,
    "account_status" INTEGER NOT NULL DEFAULT 1,
    "business_name" TEXT,
    "amount_spent" TEXT,
    "balance" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_connections_admin_user_id_key" ON "meta_connections"("admin_user_id");
CREATE UNIQUE INDEX "meta_ad_accounts_connection_id_account_id_key" ON "meta_ad_accounts"("connection_id", "account_id");

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
