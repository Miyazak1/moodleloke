CREATE TABLE "question_supply_scheduler_runs" (
    "id" TEXT NOT NULL,
    "scheduler_id" VARCHAR(40) NOT NULL,
    "worker_id" VARCHAR(120) NOT NULL,
    "trigger" VARCHAR(24) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'running',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "error_code" VARCHAR(80),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_supply_scheduler_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "question_supply_scheduler_runs_trigger_check"
      CHECK ("trigger" IN ('scheduled', 'manual')),
    CONSTRAINT "question_supply_scheduler_runs_status_check"
      CHECK ("status" IN ('running', 'succeeded', 'failed', 'lease_expired'))
);

CREATE INDEX "idx_question_supply_scheduler_runs_started"
  ON "question_supply_scheduler_runs"("scheduler_id", "started_at");

CREATE INDEX "idx_question_supply_scheduler_runs_status"
  ON "question_supply_scheduler_runs"("status", "started_at");
