-- CreateTable
CREATE TABLE "billing_projections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "projection_code" VARCHAR(20) NOT NULL,
    "client_name" VARCHAR(200) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDIENTE_FACTURAR',
    "billing_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_projections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_projections_projection_code_key" ON "billing_projections"("projection_code");

-- AddForeignKey
ALTER TABLE "billing_projections" ADD CONSTRAINT "billing_projections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
