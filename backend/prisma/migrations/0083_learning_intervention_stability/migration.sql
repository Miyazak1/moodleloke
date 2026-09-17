DROP INDEX IF EXISTS "learning_intervention_verifications_delivery_id_key";
DROP INDEX IF EXISTS "learning_intervention_outcomes_delivery_id_key";

ALTER TABLE "learning_intervention_verifications"
  ADD COLUMN "phase" VARCHAR(32) NOT NULL DEFAULT 'immediate',
  ADD COLUMN "selection_constraints" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "due_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "uq_learning_intervention_verification_delivery_phase"
  ON "learning_intervention_verifications"("delivery_id", "phase");
CREATE INDEX "idx_learning_intervention_verifications_user_due"
  ON "learning_intervention_verifications"("user_id", "status", "due_at");

CREATE TABLE "learning_intervention_stability_assessments" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "intervention_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "result" VARCHAR(32),
  "policy_version" VARCHAR(80) NOT NULL,
  "phase_results" JSONB NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "evaluated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_intervention_stability_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_intervention_stability_assessments_delivery_id_key"
  ON "learning_intervention_stability_assessments"("delivery_id");
CREATE INDEX "idx_learning_intervention_stability_user_status"
  ON "learning_intervention_stability_assessments"("user_id", "status", "updated_at");
CREATE INDEX "idx_learning_intervention_stability_intervention"
  ON "learning_intervention_stability_assessments"("intervention_id");

ALTER TABLE "learning_intervention_stability_assessments"
  ADD CONSTRAINT "learning_intervention_stability_delivery_fkey"
  FOREIGN KEY ("delivery_id") REFERENCES "learning_intervention_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_stability_assessments"
  ADD CONSTRAINT "learning_intervention_stability_intervention_fkey"
  FOREIGN KEY ("intervention_id") REFERENCES "learning_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_stability_assessments"
  ADD CONSTRAINT "learning_intervention_stability_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
