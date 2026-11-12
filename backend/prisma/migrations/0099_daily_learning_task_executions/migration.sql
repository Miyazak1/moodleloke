CREATE TABLE "daily_learning_task_executions" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "plan_date" VARCHAR(10) NOT NULL,
  "task_id" VARCHAR(180) NOT NULL,
  "policy_version" VARCHAR(80) NOT NULL,
  "task_kind" VARCHAR(40) NOT NULL,
  "subject" VARCHAR(24) NOT NULL,
  "entry" VARCHAR(32) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'started',
  "topic_id" INTEGER,
  "artifact_id" VARCHAR(120),
  "review_item_id" INTEGER,
  "round_id" INTEGER,
  "source_entity_type" VARCHAR(60),
  "source_entity_id" VARCHAR(120),
  "positive_outcome" BOOLEAN,
  "context" JSONB,
  "outcome" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "daily_learning_task_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_daily_learning_task_execution_user_date_task"
  ON "daily_learning_task_executions"("user_id", "plan_date", "task_id");

CREATE INDEX "idx_daily_learning_task_execution_user_date_status"
  ON "daily_learning_task_executions"("user_id", "plan_date", "status");

CREATE INDEX "idx_daily_learning_task_execution_quality"
  ON "daily_learning_task_executions"("user_id", "task_kind", "subject", "completed_at");

CREATE INDEX "idx_daily_learning_task_execution_artifact"
  ON "daily_learning_task_executions"("artifact_id");

CREATE INDEX "idx_daily_learning_task_execution_review"
  ON "daily_learning_task_executions"("review_item_id");

CREATE INDEX "idx_daily_learning_task_execution_source"
  ON "daily_learning_task_executions"("user_id", "source_entity_type", "source_entity_id");

ALTER TABLE "daily_learning_task_executions"
  ADD CONSTRAINT "daily_learning_task_executions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
