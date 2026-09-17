ALTER TABLE "cart_items" ADD COLUMN "dedupe_key" VARCHAR(120);

UPDATE "cart_items"
SET "dedupe_key" = CASE
  WHEN "type" = 'SCHOOL_SERVICE' THEN 'SCHOOL_SERVICE:' || COALESCE("school_id"::text, 'unknown')
  ELSE 'ADVISOR_PACKAGE'
END
WHERE "dedupe_key" IS NULL;

WITH duplicate_groups AS (
  SELECT
    "user_id",
    "dedupe_key",
    MIN("id") AS keep_id,
    CASE
      WHEN MIN("type"::text) = 'ADVISOR_PACKAGE' THEN LEAST(20, SUM("quantity"))
      ELSE 1
    END AS next_quantity
  FROM "cart_items"
  GROUP BY "user_id", "dedupe_key"
  HAVING COUNT(*) > 1
)
UPDATE "cart_items" item
SET "quantity" = duplicate_groups.next_quantity
FROM duplicate_groups
WHERE item."id" = duplicate_groups.keep_id;

WITH duplicate_rows AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "user_id", "dedupe_key" ORDER BY "id" ASC) AS row_number
  FROM "cart_items"
)
DELETE FROM "cart_items"
USING duplicate_rows
WHERE "cart_items"."id" = duplicate_rows."id"
  AND duplicate_rows.row_number > 1;

ALTER TABLE "cart_items" ALTER COLUMN "dedupe_key" SET NOT NULL;
CREATE UNIQUE INDEX "uq_cart_items_user_dedupe" ON "cart_items"("user_id", "dedupe_key");

ALTER TABLE "orders" ADD COLUMN "checkout_key" VARCHAR(120);
CREATE UNIQUE INDEX "uq_orders_user_checkout_key" ON "orders"("user_id", "checkout_key");

ALTER TABLE "mock_exam_attempts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "special_practice_sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
