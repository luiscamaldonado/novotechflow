-- AlterTable
ALTER TABLE "users" ADD COLUMN     "signature_asset_id" UUID;

-- CreateTable
CREATE TABLE "image_assets" (
    "id" UUID NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_sha256_key" ON "image_assets"("sha256");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_signature_asset_id_fkey" FOREIGN KEY ("signature_asset_id") REFERENCES "image_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
