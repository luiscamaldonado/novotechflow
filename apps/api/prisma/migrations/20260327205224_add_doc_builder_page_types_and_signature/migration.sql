/*
  Warnings:

  - The values [INTRO] on the enum `PageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- Migrate existing INTRO pages to PRESENTATION before enum change
UPDATE "proposal_pages" SET "page_type" = 'COVER' WHERE "page_type" = 'INTRO';
UPDATE "pdf_templates" SET "template_type" = 'COVER' WHERE "template_type" = 'INTRO';

-- AlterEnum
BEGIN;
CREATE TYPE "PageType_new" AS ENUM ('COVER', 'PRESENTATION', 'COMPANY_INFO', 'INDEX', 'TERMS', 'CUSTOM');
ALTER TABLE "proposal_pages" ALTER COLUMN "page_type" TYPE "PageType_new" USING ("page_type"::text::"PageType_new");
ALTER TABLE "pdf_templates" ALTER COLUMN "template_type" TYPE "PageType_new" USING ("template_type"::text::"PageType_new");
ALTER TYPE "PageType" RENAME TO "PageType_old";
ALTER TYPE "PageType_new" RENAME TO "PageType";
DROP TYPE "PageType_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "signature_url" VARCHAR(500);
