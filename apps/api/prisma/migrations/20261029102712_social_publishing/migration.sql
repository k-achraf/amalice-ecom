-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('Facebook', 'Instagram');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('Active', 'Expired');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('Published', 'Failed');

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "external_id" TEXT,
    "external_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_external_id_key" ON "social_accounts"("platform", "external_id");

-- CreateIndex
CREATE INDEX "social_posts_product_id_created_at_idx" ON "social_posts"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
