/*
  Warnings:

  - The values [PRODUCT,SERVICE] on the enum `ItemType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('PCS', 'ACCESSORIES', 'PC_SERVICES', 'SOFTWARE', 'INFRASTRUCTURE', 'INFRA_SERVICES');
ALTER TABLE "proposal_items" ALTER COLUMN "item_type" TYPE "ItemType_new" USING ("item_type"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "ItemType_old";
COMMIT;

-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "technical_specs" JSONB;

-- AlterTable
ALTER TABLE "scenario_items" ADD COLUMN     "parent_id" UUID;

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "currency" VARCHAR(5) NOT NULL DEFAULT 'COP';

-- CreateTable
CREATE TABLE "catalogs" (
    "id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogs_category_value_key" ON "catalogs"("category", "value");

-- AddForeignKey
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "scenario_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
