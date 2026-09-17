CREATE TABLE "csca_subject_practice_production_runs" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(60) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'planned',
  "trigger_type" VARCHAR(60) NOT NULL DEFAULT 'manual',
  "syllabus_version" VARCHAR(80),
  "target_policy_version" VARCHAR(80) NOT NULL DEFAULT 'subject-practice-matrix-v1',
  "target_total" INTEGER NOT NULL DEFAULT 0,
  "published_total" INTEGER NOT NULL DEFAULT 0,
  "candidate_total" INTEGER NOT NULL DEFAULT 0,
  "failed_total" INTEGER NOT NULL DEFAULT 0,
  "open_total" INTEGER NOT NULL DEFAULT 0,
  "no_progress_rounds" INTEGER NOT NULL DEFAULT 0,
  "max_no_progress_rounds" INTEGER NOT NULL DEFAULT 3,
  "blocked_reason_code" VARCHAR(120),
  "blocked_message" TEXT,
  "plan" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "result" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "csca_subject_practice_production_cells" (
  "id" SERIAL PRIMARY KEY,
  "run_id" INTEGER NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "topic_code" VARCHAR(120),
  "topic_title" VARCHAR(500) NOT NULL,
  "difficulty_band" VARCHAR(40) NOT NULL,
  "target_count" INTEGER NOT NULL DEFAULT 0,
  "candidate_limit" INTEGER NOT NULL DEFAULT 0,
  "published_count" INTEGER NOT NULL DEFAULT 0,
  "candidate_count" INTEGER NOT NULL DEFAULT 0,
  "running_job_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(40) NOT NULL DEFAULT 'open',
  "target_profile" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "last_job_id" INTEGER,
  "failure_code" VARCHAR(120),
  "failure_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "csca_subject_practice_production_cells_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "csca_subject_practice_production_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_subject_practice_prod_runs_subject_status"
  ON "csca_subject_practice_production_runs"("subject", "status", "updated_at");

CREATE INDEX "idx_subject_practice_prod_cells_run_status"
  ON "csca_subject_practice_production_cells"("run_id", "status");

CREATE INDEX "idx_subject_practice_prod_cells_topic_difficulty"
  ON "csca_subject_practice_production_cells"("subject", "topic_id", "difficulty_band");
