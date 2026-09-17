CREATE TABLE IF NOT EXISTS "csca_ai_questioning_tasks" (
  "id" UUID NOT NULL,
  "task_type" VARCHAR(80) NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "subject" VARCHAR(60),
  "resource_type" VARCHAR(80),
  "resource_id" VARCHAR(120),
  "filter_snapshot" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
  "requested" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "result" JSONB,
  "created_by" INTEGER,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "csca_ai_questioning_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_csca_ai_questioning_tasks_type_status"
ON "csca_ai_questioning_tasks"("task_type", "status", "updated_at");

CREATE INDEX IF NOT EXISTS "idx_csca_ai_questioning_tasks_subject_action"
ON "csca_ai_questioning_tasks"("subject", "action", "updated_at");
