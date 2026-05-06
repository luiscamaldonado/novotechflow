-- CreateEnum
CREATE TYPE "ConsecutiveSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "consecutive_source" "ConsecutiveSource" NOT NULL DEFAULT 'AUTO';
