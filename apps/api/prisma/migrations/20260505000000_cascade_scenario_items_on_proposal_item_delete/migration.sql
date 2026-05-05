-- Drop existing RESTRICT FK
ALTER TABLE "scenario_items" DROP CONSTRAINT "scenario_items_item_id_fkey";

-- Recreate FK with ON DELETE CASCADE
ALTER TABLE "scenario_items"
  ADD CONSTRAINT "scenario_items_item_id_fkey"
  FOREIGN KEY ("item_id")
  REFERENCES "proposal_items"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
