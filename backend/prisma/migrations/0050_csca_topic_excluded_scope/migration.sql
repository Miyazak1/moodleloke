ALTER TABLE "csca_exam_topics"
  ADD COLUMN IF NOT EXISTS "excluded_scope" JSONB;
