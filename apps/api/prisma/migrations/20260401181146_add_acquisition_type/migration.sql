-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('VENTA', 'DAAS');

-- AlterTable
ALTER TABLE "billing_projections" ADD COLUMN     "acquisition_type" "AcquisitionType";

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "acquisition_type" "AcquisitionType";
