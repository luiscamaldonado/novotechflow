-- DropForeignKey
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_items" DROP CONSTRAINT "proposal_items_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_pages" DROP CONSTRAINT "proposal_pages_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_items" DROP CONSTRAINT "scenario_items_scenario_id_fkey";

-- DropForeignKey
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_proposal_id_fkey";

-- CreateIndex
CREATE INDEX "billing_projections_user_id_idx" ON "billing_projections"("user_id");

-- CreateIndex
CREATE INDEX "email_logs_user_id_idx" ON "email_logs"("user_id");

-- CreateIndex
CREATE INDEX "email_logs_proposal_id_idx" ON "email_logs"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_items_proposal_id_idx" ON "proposal_items"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_page_blocks_page_id_idx" ON "proposal_page_blocks"("page_id");

-- CreateIndex
CREATE INDEX "proposal_pages_proposal_id_idx" ON "proposal_pages"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_versions_proposal_id_idx" ON "proposal_versions"("proposal_id");

-- CreateIndex
CREATE INDEX "proposals_user_id_idx" ON "proposals"("user_id");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "proposals_client_id_idx" ON "proposals"("client_id");

-- CreateIndex
CREATE INDEX "proposals_created_at_idx" ON "proposals"("created_at");

-- CreateIndex
CREATE INDEX "scenario_items_scenario_id_idx" ON "scenario_items"("scenario_id");

-- CreateIndex
CREATE INDEX "scenario_items_item_id_idx" ON "scenario_items"("item_id");

-- CreateIndex
CREATE INDEX "scenario_items_parent_id_idx" ON "scenario_items"("parent_id");

-- CreateIndex
CREATE INDEX "scenarios_proposal_id_idx" ON "scenarios"("proposal_id");

-- CreateIndex
CREATE INDEX "synced_files_user_id_idx" ON "synced_files"("user_id");

-- CreateIndex
CREATE INDEX "synced_files_proposal_id_idx" ON "synced_files"("proposal_id");

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_pages" ADD CONSTRAINT "proposal_pages_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
