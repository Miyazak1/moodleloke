ALTER TABLE "csca_adaptive_round_items"
  ADD COLUMN IF NOT EXISTS "question_source" VARCHAR(60) NOT NULL DEFAULT 'special_practice';

DROP INDEX IF EXISTS "uq_csca_adaptive_round_items_round_question";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_adaptive_round_items_round_source_question"
  ON "csca_adaptive_round_items" ("round_id", "question_source", "question_id");

CREATE INDEX IF NOT EXISTS "idx_csca_adaptive_round_items_source_question"
  ON "csca_adaptive_round_items" ("question_source", "question_id");
