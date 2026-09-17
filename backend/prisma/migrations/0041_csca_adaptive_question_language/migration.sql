ALTER TABLE "csca_adaptive_sessions"
  ADD COLUMN IF NOT EXISTS "question_language" VARCHAR(20) NOT NULL DEFAULT 'zh';
