/*
  Warnings:

  - You are about to drop the column `section_id` on the `proposal_items` table. All the data in the column will be lost.
  - You are about to drop the `proposal_sections` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `template_type` on the `pdf_templates` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('COVER', 'INTRO', 'TERMS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('RICH_TEXT', 'IMAGE');

-- DropForeignKey
ALTER TABLE "proposal_items" DROP CONSTRAINT "proposal_items_section_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_sections" DROP CONSTRAINT "proposal_sections_proposal_id_fkey";

-- AlterTable
ALTER TABLE "pdf_templates" DROP COLUMN "template_type",
ADD COLUMN     "template_type" "PageType" NOT NULL;

-- AlterTable
ALTER TABLE "proposal_items" DROP COLUMN "section_id",
ADD COLUMN     "page_id" UUID;

-- DropTable
DROP TABLE "proposal_sections";

-- DropEnum
DROP TYPE "SectionType";

-- DropEnum
DROP TYPE "TemplateType";

-- CreateTable
CREATE TABLE "proposal_pages" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "page_type" "PageType" NOT NULL,
    "title" VARCHAR(200),
    "variables" JSONB,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_page_blocks" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "block_type" "BlockType" NOT NULL,
    "content" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_page_blocks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "proposal_pages" ADD CONSTRAINT "proposal_pages_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_page_blocks" ADD CONSTRAINT "proposal_page_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "proposal_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "proposal_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
