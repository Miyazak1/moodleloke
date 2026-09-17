CREATE TABLE "learning_intervention_verifications" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "intervention_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'recommended',
  "selection_version" VARCHAR(80) NOT NULL,
  "measurement_version" VARCHAR(80) NOT NULL,
  "content_source_version" VARCHAR(80) NOT NULL,
  "question_refs" JSONB NOT NULL,
  "supply_snapshot" JSONB NOT NULL,
  "conversation_id" VARCHAR(120),
  "offer_request_id" VARCHAR(120) NOT NULL,
  "start_request_id" VARCHAR(120),
  "round_id" INTEGER,
  "recommended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_intervention_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_intervention_outcomes" (
  "id" TEXT NOT NULL,
  "verification_id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "intervention_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "result" VARCHAR(32) NOT NULL,
  "correct_count" INTEGER NOT NULL,
  "total_count" INTEGER NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL,
  "independent" BOOLEAN NOT NULL DEFAULT false,
  "evidence_refs" JSONB NOT NULL,
  "measurement_version" VARCHAR(80) NOT NULL,
  "metadata" JSONB,
  "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_intervention_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_intervention_verifications_delivery_id_key" ON "learning_intervention_verifications"("delivery_id");
CREATE UNIQUE INDEX "learning_intervention_verifications_round_id_key" ON "learning_intervention_verifications"("round_id");
CREATE UNIQUE INDEX "uq_learning_intervention_verification_offer" ON "learning_intervention_verifications"("user_id", "offer_request_id");
CREATE UNIQUE INDEX "uq_learning_intervention_verification_start" ON "learning_intervention_verifications"("user_id", "start_request_id");
CREATE INDEX "idx_learning_intervention_verifications_user_status" ON "learning_intervention_verifications"("user_id", "status", "updated_at");
CREATE INDEX "idx_learning_intervention_verifications_intervention" ON "learning_intervention_verifications"("intervention_id", "created_at");
CREATE UNIQUE INDEX "learning_intervention_outcomes_verification_id_key" ON "learning_intervention_outcomes"("verification_id");
CREATE UNIQUE INDEX "learning_intervention_outcomes_delivery_id_key" ON "learning_intervention_outcomes"("delivery_id");
CREATE INDEX "idx_learning_intervention_outcomes_user_evaluated" ON "learning_intervention_outcomes"("user_id", "evaluated_at");
CREATE INDEX "idx_learning_intervention_outcomes_intervention" ON "learning_intervention_outcomes"("intervention_id");

ALTER TABLE "learning_intervention_verifications" ADD CONSTRAINT "learning_intervention_verifications_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "learning_intervention_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_verifications" ADD CONSTRAINT "learning_intervention_verifications_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "learning_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_verifications" ADD CONSTRAINT "learning_intervention_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_verifications" ADD CONSTRAINT "learning_intervention_verifications_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "csca_adaptive_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_outcomes" ADD CONSTRAINT "learning_intervention_outcomes_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "learning_intervention_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_outcomes" ADD CONSTRAINT "learning_intervention_outcomes_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "learning_intervention_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_outcomes" ADD CONSTRAINT "learning_intervention_outcomes_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "learning_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_outcomes" ADD CONSTRAINT "learning_intervention_outcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
