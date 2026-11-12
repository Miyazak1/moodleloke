CREATE TABLE "verified_question_generation_tasks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "request_key" VARCHAR(64) NOT NULL,
  "user_id" INTEGER,
  "plugin_id" VARCHAR(80) NOT NULL,
  "input" JSONB NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'queued',
  "question_ids" JSONB NOT NULL DEFAULT '[]',
  "lease_owner" VARCHAR(80),
  "lease_until" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(120),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "verified_question_generation_tasks_request_key_key" ON "verified_question_generation_tasks"("request_key");
CREATE INDEX "idx_verified_generation_state_lease" ON "verified_question_generation_tasks"("state", "lease_until");
CREATE INDEX "idx_verified_generation_user_time" ON "verified_question_generation_tasks"("user_id", "created_at");
