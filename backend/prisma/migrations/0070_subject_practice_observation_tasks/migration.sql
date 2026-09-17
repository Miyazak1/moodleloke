ALTER TABLE "csca_ai_questioning_tasks"
  ADD COLUMN IF NOT EXISTS "execution_owner_id" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "execution_attempt_token" UUID,
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_requested_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_ai_questioning_tasks_active_observation"
  ON "csca_ai_questioning_tasks" ("task_type")
  WHERE "task_type" = 'subject_practice_observation'
    AND "status" IN ('queued', 'running');

CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_ai_generation_jobs_observation_task"
  ON "csca_ai_generation_jobs" (("prompt_metadata"->>'observationTaskId'))
  WHERE COALESCE("prompt_metadata"->>'observationTaskId', '') <> '';

CREATE INDEX IF NOT EXISTS "idx_csca_ai_generation_jobs_work_class_status"
  ON "csca_ai_generation_jobs" (("prompt_metadata"->>'workClass'), "status", "updated_at");
