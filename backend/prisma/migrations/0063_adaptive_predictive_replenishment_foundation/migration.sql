CREATE TABLE "csca_learning_cohorts" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "subject" VARCHAR(60),
  "source" VARCHAR(60) NOT NULL DEFAULT 'rolling',
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "organization_id" INTEGER,
  "organization_cohort_id" INTEGER,
  "team_key" VARCHAR(160),
  "start_at" TIMESTAMP(3),
  "target_exam_at" TIMESTAMP(3),
  "end_at" TIMESTAMP(3),
  "cooling_started_at" TIMESTAMP(3),
  "inactive_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "csca_student_learning_cycles" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "cohort_id" INTEGER,
  "organization_id" INTEGER,
  "organization_cohort_id" INTEGER,
  "team_key" VARCHAR(160),
  "subject" VARCHAR(60) NOT NULL,
  "phase" VARCHAR(60) NOT NULL DEFAULT 'foundation',
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_active_at" TIMESTAMP(3),
  "target_exam_at" TIMESTAMP(3),
  "completed_topic_ids" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "csca_adaptive_usage_aggregates" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "cohort_id" INTEGER,
  "organization_id" INTEGER,
  "organization_cohort_id" INTEGER,
  "team_key" VARCHAR(160),
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "difficulty_band" VARCHAR(40) NOT NULL,
  "question_type" VARCHAR(100) NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "window_end" TIMESTAMP(3) NOT NULL,
  "exposure_count" INTEGER NOT NULL DEFAULT 0,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "unique_user_count" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "repeat_exposure_count" INTEGER NOT NULL DEFAULT 0,
  "fallback_draw_count" INTEGER NOT NULL DEFAULT 0,
  "no_question_error_count" INTEGER NOT NULL DEFAULT 0,
  "average_response_time_ms" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "csca_adaptive_inventory_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "cohort_id" INTEGER,
  "organization_id" INTEGER,
  "organization_cohort_id" INTEGER,
  "team_key" VARCHAR(160),
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "difficulty_band" VARCHAR(40) NOT NULL,
  "question_type" VARCHAR(100) NOT NULL,
  "global_effective_stock" INTEGER NOT NULL DEFAULT 0,
  "manual_stock" INTEGER NOT NULL DEFAULT 0,
  "ai_formal_stock" INTEGER NOT NULL DEFAULT 0,
  "candidate_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "safety_stock" INTEGER NOT NULL DEFAULT 0,
  "cycle_target_stock" INTEGER NOT NULL DEFAULT 0,
  "max_stock_cap" INTEGER NOT NULL DEFAULT 0,
  "required_published_count" INTEGER NOT NULL DEFAULT 0,
  "active_user_count" INTEGER NOT NULL DEFAULT 0,
  "team_active_user_count" INTEGER NOT NULL DEFAULT 0,
  "user_low_availability_count" INTEGER NOT NULL DEFAULT 0,
  "team_low_availability_user_count" INTEGER NOT NULL DEFAULT 0,
  "user_coverage_pressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "team_user_coverage_pressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "team_pressure_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "projected_days_to_safety" DOUBLE PRECISION,
  "risk_level" VARCHAR(40) NOT NULL DEFAULT 'low',
  "risk_reasons" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "csca_adaptive_inventory_events" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "cohort_id" INTEGER,
  "organization_id" INTEGER,
  "organization_cohort_id" INTEGER,
  "team_key" VARCHAR(160),
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER,
  "difficulty_band" VARCHAR(40),
  "question_type" VARCHAR(100),
  "event_type" VARCHAR(80) NOT NULL,
  "question_id" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_csca_learning_cohorts_subject_status"
  ON "csca_learning_cohorts"("subject", "status");
CREATE INDEX "idx_csca_learning_cohorts_org_scope"
  ON "csca_learning_cohorts"("organization_id", "organization_cohort_id", "status");
CREATE INDEX "idx_csca_learning_cohorts_source_status"
  ON "csca_learning_cohorts"("source", "status");

CREATE INDEX "idx_student_learning_cycles_user_subject"
  ON "csca_student_learning_cycles"("user_id", "subject", "status");
CREATE INDEX "idx_student_learning_cycles_cohort_subject"
  ON "csca_student_learning_cycles"("cohort_id", "subject", "status");
CREATE INDEX "idx_student_learning_cycles_org_scope"
  ON "csca_student_learning_cycles"("organization_id", "organization_cohort_id", "status");

CREATE UNIQUE INDEX "uq_adaptive_usage_aggregates_window"
  ON "csca_adaptive_usage_aggregates"("user_id", "cohort_id", "subject", "topic_id", "difficulty_band", "question_type", "window_start", "window_end");
CREATE INDEX "idx_adaptive_usage_aggregates_user_window"
  ON "csca_adaptive_usage_aggregates"("user_id", "subject", "window_end");
CREATE INDEX "idx_adaptive_usage_aggregates_inventory_key"
  ON "csca_adaptive_usage_aggregates"("subject", "topic_id", "difficulty_band");
CREATE INDEX "idx_adaptive_usage_aggregates_org_window"
  ON "csca_adaptive_usage_aggregates"("organization_id", "organization_cohort_id", "window_end");
CREATE INDEX "idx_adaptive_usage_aggregates_window_end"
  ON "csca_adaptive_usage_aggregates"("window_end");

CREATE INDEX "idx_adaptive_inventory_snapshots_key"
  ON "csca_adaptive_inventory_snapshots"("subject", "topic_id", "difficulty_band", "question_type");
CREATE INDEX "idx_adaptive_inventory_snapshots_user_risk"
  ON "csca_adaptive_inventory_snapshots"("user_id", "risk_level", "snapshot_at");
CREATE INDEX "idx_adaptive_inventory_snapshots_cohort_risk"
  ON "csca_adaptive_inventory_snapshots"("cohort_id", "risk_level", "snapshot_at");
CREATE INDEX "idx_adaptive_inventory_snapshots_org_risk"
  ON "csca_adaptive_inventory_snapshots"("organization_id", "organization_cohort_id", "risk_level");
CREATE INDEX "idx_adaptive_inventory_snapshots_risk_time"
  ON "csca_adaptive_inventory_snapshots"("risk_level", "snapshot_at");

CREATE INDEX "idx_adaptive_inventory_events_key_time"
  ON "csca_adaptive_inventory_events"("subject", "topic_id", "difficulty_band", "created_at");
CREATE INDEX "idx_adaptive_inventory_events_type_time"
  ON "csca_adaptive_inventory_events"("event_type", "created_at");
CREATE INDEX "idx_adaptive_inventory_events_cohort_type"
  ON "csca_adaptive_inventory_events"("cohort_id", "event_type", "created_at");
CREATE INDEX "idx_adaptive_inventory_events_org_time"
  ON "csca_adaptive_inventory_events"("organization_id", "organization_cohort_id", "created_at");
CREATE INDEX "idx_adaptive_inventory_events_user_time"
  ON "csca_adaptive_inventory_events"("user_id", "created_at");
