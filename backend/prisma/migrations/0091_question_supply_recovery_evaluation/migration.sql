CREATE TABLE "question_supply_recovery_confirmations" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "request_cycle" INTEGER NOT NULL,
  "confirmation_kind" VARCHAR(40) NOT NULL,
  "source" VARCHAR(40) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "requested_count" INTEGER NOT NULL,
  "available_count" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_supply_recovery_confirmations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_question_supply_recovery_cycle" CHECK ("request_cycle" > 0),
  CONSTRAINT "ck_question_supply_recovery_kind" CHECK ("confirmation_kind" IN ('domain_preflight_passed','task_started')),
  CONSTRAINT "ck_question_supply_recovery_counts" CHECK ("requested_count" > 0 AND "available_count" >= "requested_count")
);

CREATE UNIQUE INDEX "uq_question_supply_recovery_confirmation"
  ON "question_supply_recovery_confirmations"("request_id", "request_cycle", "confirmation_kind");
CREATE INDEX "idx_question_supply_recovery_confirmed_kind"
  ON "question_supply_recovery_confirmations"("confirmed_at", "confirmation_kind");
CREATE INDEX "idx_question_supply_recovery_source_subject"
  ON "question_supply_recovery_confirmations"("source", "subject_code", "confirmed_at");

ALTER TABLE "question_supply_recovery_confirmations"
  ADD CONSTRAINT "question_supply_recovery_confirmations_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "question_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "question_supply_inventory_checks" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "request_cycle" INTEGER NOT NULL,
  "result" VARCHAR(32) NOT NULL,
  "checker_version" VARCHAR(80) NOT NULL,
  "requested_count" INTEGER NOT NULL,
  "available_count" INTEGER,
  "error_code" VARCHAR(80),
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_supply_inventory_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_question_supply_inventory_cycle" CHECK ("request_cycle" > 0),
  CONSTRAINT "ck_question_supply_inventory_result" CHECK ("result" IN ('still_short','sufficient','check_failed')),
  CONSTRAINT "ck_question_supply_inventory_counts" CHECK (
    "requested_count" > 0 AND ("available_count" IS NULL OR "available_count" >= 0)
  )
);

CREATE INDEX "idx_question_supply_inventory_request_cycle"
  ON "question_supply_inventory_checks"("request_id", "request_cycle", "checked_at");
CREATE INDEX "idx_question_supply_inventory_result_checked"
  ON "question_supply_inventory_checks"("result", "checked_at");

ALTER TABLE "question_supply_inventory_checks"
  ADD CONSTRAINT "question_supply_inventory_checks_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "question_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
