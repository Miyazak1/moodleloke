CREATE TABLE "question_supply_requests" (
  "id" TEXT NOT NULL,
  "request_key" VARCHAR(64) NOT NULL,
  "schema_version" VARCHAR(16) NOT NULL DEFAULT '1',
  "source" VARCHAR(48) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "topic_ids" JSONB NOT NULL,
  "difficulty" VARCHAR(24),
  "task_type" VARCHAR(48) NOT NULL,
  "verification_phase" VARCHAR(24),
  "source_policy" VARCHAR(48) NOT NULL DEFAULT 'reviewed_published_only',
  "status" VARCHAR(24) NOT NULL DEFAULT 'open',
  "priority" VARCHAR(16) NOT NULL DEFAULT 'normal',
  "requested_count" INTEGER NOT NULL,
  "available_count" INTEGER NOT NULL,
  "observation_count" INTEGER NOT NULL DEFAULT 1,
  "last_context_snapshot" JSONB NOT NULL DEFAULT '{}',
  "first_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "resolution_note" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "question_supply_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_question_supply_request_source" CHECK ("source" IN ('agent_today_plan','intervention_verification')),
  CONSTRAINT "ck_question_supply_request_subject" CHECK ("subject_code" IN ('math','physics','chemistry')),
  CONSTRAINT "ck_question_supply_request_status" CHECK ("status" IN ('open','acknowledged','resolved','dismissed')),
  CONSTRAINT "ck_question_supply_request_priority" CHECK ("priority" IN ('normal','high','urgent')),
  CONSTRAINT "ck_question_supply_request_counts" CHECK ("requested_count" > 0 AND "available_count" >= 0 AND "available_count" < "requested_count" AND "observation_count" > 0),
  CONSTRAINT "ck_question_supply_request_phase" CHECK ("verification_phase" IS NULL OR "verification_phase" IN ('immediate','retention','transfer'))
);

CREATE TABLE "question_supply_request_events" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "actor_user_id" INTEGER,
  "action" VARCHAR(32) NOT NULL,
  "from_status" VARCHAR(24),
  "to_status" VARCHAR(24) NOT NULL,
  "reason" VARCHAR(500),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_supply_request_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_question_supply_request_event_status" CHECK (
    ("from_status" IS NULL OR "from_status" IN ('open','acknowledged','resolved','dismissed'))
    AND "to_status" IN ('open','acknowledged','resolved','dismissed')
  )
);

CREATE UNIQUE INDEX "question_supply_requests_request_key_key" ON "question_supply_requests"("request_key");
CREATE INDEX "idx_question_supply_requests_status_priority" ON "question_supply_requests"("status", "priority", "last_observed_at");
CREATE INDEX "idx_question_supply_requests_subject_status" ON "question_supply_requests"("subject_code", "status", "last_observed_at");
CREATE INDEX "idx_question_supply_request_events_request" ON "question_supply_request_events"("request_id", "created_at");
CREATE INDEX "idx_question_supply_request_events_actor" ON "question_supply_request_events"("actor_user_id", "created_at");

ALTER TABLE "question_supply_request_events" ADD CONSTRAINT "question_supply_request_events_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "question_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_supply_request_events" ADD CONSTRAINT "question_supply_request_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_question_supply_request_event_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'question supply request events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_question_supply_request_events_append_only"
BEFORE UPDATE OR DELETE ON "question_supply_request_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_question_supply_request_event_mutation"();
