-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "cost_currency" VARCHAR(5) NOT NULL DEFAULT 'COP';

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "conversion_trm" DOUBLE PRECISION;
