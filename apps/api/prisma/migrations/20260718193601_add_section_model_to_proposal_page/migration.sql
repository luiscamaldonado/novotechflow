-- AlterTable
ALTER TABLE "proposal_pages" ADD COLUMN     "is_section_model" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_page_id" UUID;

-- CreateIndex
CREATE INDEX "proposal_pages_parent_page_id_idx" ON "proposal_pages"("parent_page_id");

-- AddForeignKey
ALTER TABLE "proposal_pages" ADD CONSTRAINT "proposal_pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "proposal_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
