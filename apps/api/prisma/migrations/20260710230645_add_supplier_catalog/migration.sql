-- CreateEnum
CREATE TYPE "SupplierSource" AS ENUM ('CSV', 'MANUAL');

-- AlterTable
ALTER TABLE "proposal_items" ADD COLUMN     "supplier_company_id" UUID,
ADD COLUMN     "supplier_contact_id" UUID;

-- CreateTable
CREATE TABLE "supplier_companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "nit" VARCHAR(15),
    "source" "SupplierSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "supplier_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_companies_nit_key" ON "supplier_companies"("nit");

-- CreateIndex
CREATE INDEX "supplier_companies_name_idx" ON "supplier_companies"("name");

-- CreateIndex
CREATE INDEX "supplier_contacts_company_id_idx" ON "supplier_contacts"("company_id");

-- CreateIndex
CREATE INDEX "proposal_items_supplier_company_id_idx" ON "proposal_items"("supplier_company_id");

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_supplier_company_id_fkey" FOREIGN KEY ("supplier_company_id") REFERENCES "supplier_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_supplier_contact_id_fkey" FOREIGN KEY ("supplier_contact_id") REFERENCES "supplier_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_companies" ADD CONSTRAINT "supplier_companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "supplier_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
