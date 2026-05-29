ALTER TABLE "scenario_items" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "scenario_items_scenario_id_sort_order_idx" ON "scenario_items"("scenario_id", "sort_order");

WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY scenario_id ORDER BY id) - 1 AS rn
    FROM "scenario_items"
    WHERE parent_id IS NULL
)
UPDATE "scenario_items" si
SET sort_order = ordered.rn
FROM ordered
WHERE si.id = ordered.id;
