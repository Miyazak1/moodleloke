ALTER TABLE "question_supply_requests" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "question_supply_requests" ADD CONSTRAINT "ck_question_supply_requests_cycle" CHECK ("cycle" > 0);

CREATE TABLE "question_supply_fulfillment_plans" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "request_cycle" INTEGER NOT NULL,
  "contract_version" VARCHAR(16) NOT NULL DEFAULT '1',
  "demand_key" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'planned',
  "mode" VARCHAR(24) NOT NULL DEFAULT 'shadow',
  "adapter_version" VARCHAR(80) NOT NULL DEFAULT 'question-supply-shadow-noop-v1',
  "demand_snapshot" JSONB NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "lease_owner" VARCHAR(120),
  "lease_until" TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error_code" VARCHAR(80),
  "dispatched_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "question_supply_fulfillment_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_question_supply_fulfillment_cycle" CHECK ("request_cycle" > 0),
  CONSTRAINT "ck_question_supply_fulfillment_status" CHECK ("status" IN ('planned','leased','shadow_dispatched','failed','completed','cancelled')),
  CONSTRAINT "ck_question_supply_fulfillment_mode" CHECK ("mode" = 'shadow'),
  CONSTRAINT "ck_question_supply_fulfillment_attempts" CHECK ("attempt_count" >= 0)
);

CREATE TABLE "question_supply_fulfillment_events" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "actor_user_id" INTEGER,
  "action" VARCHAR(40) NOT NULL,
  "from_status" VARCHAR(32),
  "to_status" VARCHAR(32) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_supply_fulfillment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_supply_fulfillment_plans_demand_key_key" ON "question_supply_fulfillment_plans"("demand_key");
CREATE UNIQUE INDEX "uq_question_supply_fulfillment_request_cycle" ON "question_supply_fulfillment_plans"("request_id", "request_cycle");
CREATE INDEX "idx_question_supply_fulfillment_dispatch" ON "question_supply_fulfillment_plans"("status", "next_attempt_at", "lease_until");
CREATE INDEX "idx_question_supply_fulfillment_events_plan" ON "question_supply_fulfillment_events"("plan_id", "created_at");
CREATE INDEX "idx_question_supply_fulfillment_events_actor" ON "question_supply_fulfillment_events"("actor_user_id", "created_at");

ALTER TABLE "question_supply_fulfillment_plans" ADD CONSTRAINT "question_supply_fulfillment_plans_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "question_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_supply_fulfillment_events" ADD CONSTRAINT "question_supply_fulfillment_events_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "question_supply_fulfillment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_supply_fulfillment_events" ADD CONSTRAINT "question_supply_fulfillment_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_question_supply_fulfillment_event_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'question supply fulfillment events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_question_supply_fulfillment_events_append_only"
BEFORE UPDATE OR DELETE ON "question_supply_fulfillment_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_question_supply_fulfillment_event_mutation"();
