-- CreateTable
CREATE TABLE "spec_options" (
    "id" UUID NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spec_options_field_name_idx" ON "spec_options"("field_name");

-- CreateIndex
CREATE UNIQUE INDEX "spec_options_field_name_value_key" ON "spec_options"("field_name", "value");
