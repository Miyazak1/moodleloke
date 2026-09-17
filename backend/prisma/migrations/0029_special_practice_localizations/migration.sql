ALTER TABLE "special_practice_topics"
  ADD COLUMN IF NOT EXISTS "localizations" JSONB;

ALTER TABLE "special_practice_questions"
  ADD COLUMN IF NOT EXISTS "localizations" JSONB;
