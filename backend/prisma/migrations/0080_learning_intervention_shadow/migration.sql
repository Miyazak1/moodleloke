CREATE TABLE "learning_interventions" (
  "id" TEXT NOT NULL,
  "decision_key" VARCHAR(128) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "state_version" VARCHAR(80) NOT NULL,
  "policy_version" VARCHAR(80) NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'shadow_proposed',
  "urgency" VARCHAR(16) NOT NULL,
  "placement" VARCHAR(32) NOT NULL,
  "trigger_codes" JSONB NOT NULL DEFAULT '[]',
  "suppression_codes" JSONB NOT NULL DEFAULT '[]',
  "content_plan" JSONB,
  "reason_summary" TEXT NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "evidence_cutoff_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_interventions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_interventions_decision_key_key" ON "learning_interventions"("decision_key");
CREATE INDEX "idx_learning_interventions_user_subject_created" ON "learning_interventions"("user_id", "subject_code", "created_at");
CREATE INDEX "idx_learning_interventions_topic_status" ON "learning_interventions"("user_id", "topic_id", "status", "created_at");
CREATE INDEX "idx_learning_interventions_status_expires" ON "learning_interventions"("status", "expires_at");

ALTER TABLE "learning_interventions" ADD CONSTRAINT "learning_interventions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
