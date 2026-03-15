-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "client_id" UUID;

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nit" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
