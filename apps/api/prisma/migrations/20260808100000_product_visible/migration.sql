-- AlterTable: unlisted-product toggle — see Product.visible's schema.prisma
-- comment. Defaults true so every existing product stays exactly as visible
-- as it already was; nothing needs to opt in.
ALTER TABLE "products" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
