-- AlterTable
ALTER TABLE "proposal_items" ALTER COLUMN "margin_pct" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "scenario_items" ALTER COLUMN "margin_pct_override" SET DATA TYPE DECIMAL(10,4);
