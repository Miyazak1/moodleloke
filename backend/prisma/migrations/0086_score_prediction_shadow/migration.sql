CREATE TABLE "score_prediction_shadow_runs" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "goal_id" TEXT NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "version_hash" VARCHAR(128) NOT NULL,
  "model_version" VARCHAR(100) NOT NULL,
  "scoring_policy_version" VARCHAR(80) NOT NULL,
  "item_calibration_version" VARCHAR(100) NOT NULL,
  "status" VARCHAR(24) NOT NULL,
  "feature_snapshot" JSONB NOT NULL,
  "baseline_output" JSONB,
  "candidate_output" JSONB,
  "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "evidence_cutoff_at" TIMESTAMP(3) NOT NULL,
  "evaluation_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_prediction_shadow_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "score_prediction_shadow_runs_subject_check" CHECK ("subject_code" = 'chemistry'),
  CONSTRAINT "score_prediction_shadow_runs_status_check" CHECK ("status" IN ('blocked', 'computed')),
  CONSTRAINT "score_prediction_shadow_runs_output_check" CHECK (
    ("status" = 'blocked' AND "baseline_output" IS NULL AND "candidate_output" IS NULL)
    OR ("status" = 'computed' AND "candidate_output" IS NOT NULL AND "baseline_output" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "uq_score_prediction_shadow_run_versions"
  ON "score_prediction_shadow_runs"("user_id", "goal_id", "subject_code", "version_hash");
CREATE INDEX "idx_score_prediction_shadow_runs_user_subject"
  ON "score_prediction_shadow_runs"("user_id", "subject_code", "created_at");
CREATE INDEX "idx_score_prediction_shadow_runs_status_model"
  ON "score_prediction_shadow_runs"("status", "model_version", "created_at");

ALTER TABLE "score_prediction_shadow_runs" ADD CONSTRAINT "score_prediction_shadow_runs_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "score_prediction_shadow_runs" ADD CONSTRAINT "score_prediction_shadow_runs_goal_fkey"
  FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "score_prediction_shadow_runs" ADD CONSTRAINT "score_prediction_shadow_runs_policy_fkey"
  FOREIGN KEY ("scoring_policy_version") REFERENCES "exam_scoring_policies"("policy_version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "score_prediction_shadow_runs" ADD CONSTRAINT "score_prediction_shadow_runs_item_calibration_fkey"
  FOREIGN KEY ("item_calibration_version") REFERENCES "item_calibration_snapshots"("calibration_version") ON DELETE RESTRICT ON UPDATE CASCADE;
