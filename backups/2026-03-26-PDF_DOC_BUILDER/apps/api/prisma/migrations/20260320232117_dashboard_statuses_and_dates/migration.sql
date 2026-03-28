-- Convert existing rows BEFORE swapping the enum
-- Map old statuses to new ones
UPDATE "proposals" SET "status" = 'DRAFT' WHERE "status" = 'DRAFT';

-- AlterEnum with safe conversion
BEGIN;
CREATE TYPE "ProposalStatus_new" AS ENUM ('ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA', 'PENDIENTE_FACTURAR', 'FACTURADA');

-- Convert existing values: DRAFT -> ELABORACION, COMPLETED -> PROPUESTA, ARCHIVED -> PERDIDA
ALTER TABLE "proposals" ALTER COLUMN "status" TYPE VARCHAR(30);
UPDATE "proposals" SET "status" = 'ELABORACION' WHERE "status" = 'DRAFT';
UPDATE "proposals" SET "status" = 'PROPUESTA' WHERE "status" = 'COMPLETED';
UPDATE "proposals" SET "status" = 'PERDIDA' WHERE "status" = 'ARCHIVED';

ALTER TABLE "proposals" ALTER COLUMN "status" TYPE "ProposalStatus_new" USING ("status"::text::"ProposalStatus_new");

ALTER TYPE "ProposalStatus" RENAME TO "ProposalStatus_old";
ALTER TYPE "ProposalStatus_new" RENAME TO "ProposalStatus";
DROP TYPE "ProposalStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN "billing_date" DATE,
ADD COLUMN "close_date" DATE,
ALTER COLUMN "status" SET DEFAULT 'ELABORACION';
