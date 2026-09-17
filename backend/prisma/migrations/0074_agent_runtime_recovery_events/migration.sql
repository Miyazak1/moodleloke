-- WA-P1 PR 5: recoverable Agent runs and replayable, idempotent SSE milestones.
ALTER TABLE "agent_runs"
  ADD COLUMN "lease_until" TIMESTAMP(3),
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "error_code" VARCHAR(80),
  ADD COLUMN "error_retryable" BOOLEAN;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_attempt_count_check" CHECK ("attempt_count" >= 0);

CREATE INDEX "idx_agent_runs_status_lease" ON "agent_runs"("status", "lease_until");

ALTER TABLE "agent_outbox"
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "event_key" VARCHAR(120);

CREATE UNIQUE INDEX "uq_agent_outbox_run_sequence" ON "agent_outbox"("run_id", "sequence");
CREATE UNIQUE INDEX "uq_agent_outbox_run_event_key" ON "agent_outbox"("run_id", "event_key");

CREATE UNIQUE INDEX "uq_agent_artifacts_run_type_version" ON "agent_artifacts"("run_id", "type", "version");
