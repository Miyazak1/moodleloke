CREATE TABLE "exam_scoring_policies" (
  "id" TEXT NOT NULL,
  "exam_system_code" VARCHAR(40) NOT NULL,
  "policy_version" VARCHAR(80) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "source_type" VARCHAR(24) NOT NULL,
  "source_title" VARCHAR(240) NOT NULL,
  "source_url" VARCHAR(1000),
  "source_published_at" DATE,
  "source_snapshot_hash" VARCHAR(128) NOT NULL,
  "score_scale" JSONB NOT NULL,
  "scoring_rules" JSONB NOT NULL,
  "effective_from" DATE,
  "effective_to" DATE,
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "supersedes_policy_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_scoring_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_scoring_policies_status_check" CHECK ("status" IN ('draft', 'reviewed', 'active', 'superseded', 'withdrawn')),
  CONSTRAINT "exam_scoring_policies_source_type_check" CHECK ("source_type" IN ('official', 'provisional')),
  CONSTRAINT "exam_scoring_policies_source_hash_check" CHECK ("source_snapshot_hash" ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT "exam_scoring_policies_source_url_check" CHECK ("source_url" IS NULL OR "source_url" ~ '^https://'),
  CONSTRAINT "exam_scoring_policies_effective_window_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "exam_scoring_policies_active_audit_check" CHECK (
    "status" <> 'active' OR (
      "source_type" = 'official' AND "source_url" IS NOT NULL AND
      "reviewed_by_user_id" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "activated_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "exam_scoring_policies_policy_version_key" ON "exam_scoring_policies"("policy_version");
CREATE UNIQUE INDEX "uq_exam_scoring_policies_one_active" ON "exam_scoring_policies"("exam_system_code") WHERE "status" = 'active';
CREATE INDEX "idx_exam_scoring_policies_system_status" ON "exam_scoring_policies"("exam_system_code", "status", "activated_at");
CREATE INDEX "idx_exam_scoring_policies_reviewer" ON "exam_scoring_policies"("reviewed_by_user_id", "reviewed_at");

CREATE TABLE "item_calibration_snapshots" (
  "id" TEXT NOT NULL,
  "calibration_version" VARCHAR(100) NOT NULL,
  "exam_system_code" VARCHAR(40) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "item_bank_version" VARCHAR(100) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'shadow',
  "sample_count" INTEGER NOT NULL,
  "item_count" INTEGER NOT NULL,
  "holdout_sample_count" INTEGER NOT NULL,
  "metrics" JSONB NOT NULL,
  "release_criteria" JSONB NOT NULL,
  "criteria_results" JSONB NOT NULL,
  "all_criteria_passed" BOOLEAN NOT NULL DEFAULT false,
  "artifact_hash" VARCHAR(128) NOT NULL,
  "data_window_start" TIMESTAMP(3) NOT NULL,
  "data_window_end" TIMESTAMP(3) NOT NULL,
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "qualified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_calibration_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_calibration_snapshots_status_check" CHECK ("status" IN ('shadow', 'reviewed', 'qualified', 'rejected', 'retired')),
  CONSTRAINT "item_calibration_snapshots_counts_check" CHECK ("sample_count" >= 0 AND "item_count" > 0 AND "holdout_sample_count" >= 0 AND "holdout_sample_count" <= "sample_count"),
  CONSTRAINT "item_calibration_snapshots_window_check" CHECK ("data_window_end" >= "data_window_start"),
  CONSTRAINT "item_calibration_snapshots_artifact_hash_check" CHECK ("artifact_hash" ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT "item_calibration_snapshots_qualified_audit_check" CHECK (
    "status" <> 'qualified' OR (
      "all_criteria_passed" = true AND "reviewed_by_user_id" IS NOT NULL AND
      "reviewed_at" IS NOT NULL AND "qualified_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "item_calibration_snapshots_calibration_version_key" ON "item_calibration_snapshots"("calibration_version");
CREATE INDEX "idx_item_calibration_scope_status" ON "item_calibration_snapshots"("exam_system_code", "subject_code", "status", "qualified_at");
CREATE INDEX "idx_item_calibration_reviewer" ON "item_calibration_snapshots"("reviewed_by_user_id", "reviewed_at");

CREATE TABLE "forecast_calibration_snapshots" (
  "id" TEXT NOT NULL,
  "calibration_version" VARCHAR(100) NOT NULL,
  "exam_system_code" VARCHAR(40) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "language_code" VARCHAR(16),
  "exam_form_code" VARCHAR(80),
  "forecast_model_version" VARCHAR(100) NOT NULL,
  "scoring_policy_version" VARCHAR(80) NOT NULL,
  "item_calibration_version" VARCHAR(100) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'shadow',
  "sample_count" INTEGER NOT NULL,
  "holdout_sample_count" INTEGER NOT NULL,
  "metrics" JSONB NOT NULL,
  "subgroup_metrics" JSONB NOT NULL,
  "release_criteria" JSONB NOT NULL,
  "criteria_results" JSONB NOT NULL,
  "all_criteria_passed" BOOLEAN NOT NULL DEFAULT false,
  "artifact_hash" VARCHAR(128) NOT NULL,
  "data_window_start" TIMESTAMP(3) NOT NULL,
  "data_window_end" TIMESTAMP(3) NOT NULL,
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "qualified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forecast_calibration_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_calibration_snapshots_status_check" CHECK ("status" IN ('shadow', 'reviewed', 'qualified', 'rejected', 'retired')),
  CONSTRAINT "forecast_calibration_snapshots_counts_check" CHECK ("sample_count" >= 0 AND "holdout_sample_count" >= 0 AND "holdout_sample_count" <= "sample_count"),
  CONSTRAINT "forecast_calibration_snapshots_window_check" CHECK ("data_window_end" >= "data_window_start"),
  CONSTRAINT "forecast_calibration_snapshots_artifact_hash_check" CHECK ("artifact_hash" ~ '^[0-9A-Fa-f]{64}$'),
  CONSTRAINT "forecast_calibration_snapshots_qualified_audit_check" CHECK (
    "status" <> 'qualified' OR (
      "all_criteria_passed" = true AND "reviewed_by_user_id" IS NOT NULL AND
      "reviewed_at" IS NOT NULL AND "qualified_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "forecast_calibration_snapshots_calibration_version_key" ON "forecast_calibration_snapshots"("calibration_version");
CREATE INDEX "idx_forecast_calibration_scope_status" ON "forecast_calibration_snapshots"("exam_system_code", "subject_code", "status", "qualified_at");
CREATE INDEX "idx_forecast_calibration_versions" ON "forecast_calibration_snapshots"("forecast_model_version", "scoring_policy_version", "item_calibration_version");
CREATE INDEX "idx_forecast_calibration_reviewer" ON "forecast_calibration_snapshots"("reviewed_by_user_id", "reviewed_at");

ALTER TABLE "exam_scoring_policies" ADD CONSTRAINT "exam_scoring_policies_reviewer_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_scoring_policies" ADD CONSTRAINT "exam_scoring_policies_supersedes_fkey"
  FOREIGN KEY ("supersedes_policy_id") REFERENCES "exam_scoring_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_calibration_snapshots" ADD CONSTRAINT "item_calibration_snapshots_reviewer_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_snapshots_policy_fkey"
  FOREIGN KEY ("scoring_policy_version") REFERENCES "exam_scoring_policies"("policy_version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_snapshots_item_calibration_fkey"
  FOREIGN KEY ("item_calibration_version") REFERENCES "item_calibration_snapshots"("calibration_version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_snapshots_reviewer_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
