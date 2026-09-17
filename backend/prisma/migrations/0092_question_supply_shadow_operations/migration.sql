CREATE TABLE "question_supply_scheduler_states" (
    "id" VARCHAR(40) NOT NULL,
    "lease_owner" VARCHAR(120),
    "lease_until" TIMESTAMP(3),
    "last_status" VARCHAR(24) NOT NULL DEFAULT 'idle',
    "last_started_at" TIMESTAMP(3),
    "last_completed_at" TIMESTAMP(3),
    "last_summary" JSONB NOT NULL DEFAULT '{}',
    "last_error_code" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_supply_scheduler_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "question_supply_scheduler_states_status_check"
      CHECK ("last_status" IN ('idle', 'running', 'succeeded', 'failed'))
);

CREATE INDEX "idx_question_supply_scheduler_lease"
  ON "question_supply_scheduler_states"("lease_until");
