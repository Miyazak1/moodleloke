ALTER TABLE "csca_source_questions"
  ADD COLUMN IF NOT EXISTS "auto_profile_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "auto_profile_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "auto_profile_max_attempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "auto_profile_next_retry_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "auto_profile_last_tried_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "auto_profile_decided_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "auto_profile_failure_type" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "auto_profile_failure_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "auto_profile_decision" JSONB,
  ADD COLUMN IF NOT EXISTS "auto_profile_gate_result" JSONB,
  ADD COLUMN IF NOT EXISTS "auto_profile_task_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_csca_source_questions_auto_profile_status"
ON "csca_source_questions"("subject", "auto_profile_status");

CREATE INDEX IF NOT EXISTS "idx_csca_source_questions_auto_profile_retry"
ON "csca_source_questions"("auto_profile_next_retry_at");
