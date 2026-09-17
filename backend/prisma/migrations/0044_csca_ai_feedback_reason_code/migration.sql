ALTER TABLE "csca_ai_interaction_feedback"
  ADD COLUMN IF NOT EXISTS "reason_code" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "idx_csca_ai_feedback_reason_created"
  ON "csca_ai_interaction_feedback" ("reason_code", "created_at");

DELETE FROM "csca_ai_interaction_feedback" old_feedback
USING "csca_ai_interaction_feedback" latest_feedback
WHERE old_feedback."interaction_id" = latest_feedback."interaction_id"
  AND old_feedback."user_id" = latest_feedback."user_id"
  AND old_feedback."user_id" IS NOT NULL
  AND (
    old_feedback."created_at" < latest_feedback."created_at"
    OR (
      old_feedback."created_at" = latest_feedback."created_at"
      AND old_feedback."id" < latest_feedback."id"
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_ai_feedback_interaction_user"
  ON "csca_ai_interaction_feedback" ("interaction_id", "user_id")
  WHERE "user_id" IS NOT NULL;
