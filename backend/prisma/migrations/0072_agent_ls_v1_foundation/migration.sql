-- LS-V1 PR 1: additive, disabled-by-default foundation only.
CREATE TABLE "student_score_goals" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "exam_system_code" VARCHAR(40) NOT NULL,
  "exam_batch_code" VARCHAR(80) NOT NULL, "exam_date" DATE NOT NULL, "version" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'active', "total_target_score" DOUBLE PRECISION,
  "availability_version" VARCHAR(80) NOT NULL, "scoring_policy_version" VARCHAR(80) NOT NULL,
  "replaces_goal_id" TEXT, "source" VARCHAR(40) NOT NULL DEFAULT 'user',
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_score_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "student_score_goals_version_check" CHECK ("version" > 0),
  CONSTRAINT "student_score_goals_status_check" CHECK ("status" IN ('active','superseded','cancelled'))
);
CREATE UNIQUE INDEX "uq_student_score_goals_version" ON "student_score_goals"("user_id","exam_system_code","exam_batch_code","version");
CREATE UNIQUE INDEX "uq_student_score_goals_active" ON "student_score_goals"("user_id","exam_system_code","exam_batch_code") WHERE "status" = 'active';
CREATE INDEX "idx_student_score_goals_user_status_created" ON "student_score_goals"("user_id","status","created_at");

CREATE TABLE "student_score_goal_subjects" (
  "id" TEXT PRIMARY KEY, "goal_id" TEXT NOT NULL, "subject_code" VARCHAR(24) NOT NULL,
  "target_score" DOUBLE PRECISION NOT NULL, "priority" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_score_goal_subjects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "student_score_goal_subjects_subject_check" CHECK ("subject_code" IN ('math','physics','chemistry')),
  CONSTRAINT "student_score_goal_subjects_priority_check" CHECK ("priority" > 0)
);
CREATE UNIQUE INDEX "uq_student_score_goal_subjects_goal_subject" ON "student_score_goal_subjects"("goal_id","subject_code");
CREATE INDEX "idx_student_score_goal_subjects_subject" ON "student_score_goal_subjects"("subject_code");

CREATE TABLE "study_availability_preferences" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "version" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'active', "timezone" VARCHAR(80) NOT NULL,
  "weekly_minutes_goal" INTEGER, "preferred_study_days" JSONB NOT NULL DEFAULT '[]',
  "default_session_minutes" INTEGER, "source" VARCHAR(40) NOT NULL DEFAULT 'user',
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "study_availability_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_availability_version_check" CHECK ("version" > 0),
  CONSTRAINT "study_availability_status_check" CHECK ("status" IN ('active','superseded','cancelled')),
  CONSTRAINT "study_availability_weekly_minutes_check" CHECK ("weekly_minutes_goal" IS NULL OR "weekly_minutes_goal" BETWEEN 1 AND 10080),
  CONSTRAINT "study_availability_session_minutes_check" CHECK ("default_session_minutes" IS NULL OR "default_session_minutes" BETWEEN 1 AND 480)
);
CREATE UNIQUE INDEX "uq_study_availability_user_version" ON "study_availability_preferences"("user_id","version");
CREATE UNIQUE INDEX "uq_study_availability_active" ON "study_availability_preferences"("user_id") WHERE "status" = 'active';
CREATE INDEX "idx_study_availability_user_status_created" ON "study_availability_preferences"("user_id","status","created_at");

CREATE TABLE "learning_evidence_events" (
  "id" TEXT PRIMARY KEY, "schema_version" VARCHAR(16) NOT NULL, "event_id" VARCHAR(80) NOT NULL UNIQUE,
  "event_sequence" BIGINT NOT NULL, "user_id" INTEGER NOT NULL, "subject_code" VARCHAR(24) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL, "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_type" VARCHAR(40) NOT NULL, "source_id" VARCHAR(120) NOT NULL, "attempt_sequence" INTEGER NOT NULL,
  "session_id" VARCHAR(120), "question_id" VARCHAR(120) NOT NULL, "question_version" INTEGER NOT NULL,
  "answer_key_version" VARCHAR(80) NOT NULL, "topic_mapping_version" VARCHAR(80) NOT NULL,
  "scoring_rubric_version" VARCHAR(80), "exposure_state" VARCHAR(32) NOT NULL,
  "topic_evidence" JSONB NOT NULL, "outcome" VARCHAR(24) NOT NULL, "first_attempt" BOOLEAN NOT NULL,
  "used_hint" BOOLEAN NOT NULL DEFAULT false, "used_explanation" BOOLEAN NOT NULL DEFAULT false,
  "time_spent_seconds" INTEGER, "difficulty" VARCHAR(40), "question_quality_confidence" DOUBLE PRECISION NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "learning_evidence_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_evidence_subject_check" CHECK ("subject_code" IN ('math','physics','chemistry')),
  CONSTRAINT "learning_evidence_sequence_check" CHECK ("event_sequence" > 0),
  CONSTRAINT "learning_evidence_quality_check" CHECK ("question_quality_confidence" BETWEEN 0 AND 1),
  CONSTRAINT "learning_evidence_time_check" CHECK ("time_spent_seconds" IS NULL OR "time_spent_seconds" >= 0)
);
CREATE UNIQUE INDEX "uq_learning_evidence_business_key" ON "learning_evidence_events"("source_type","source_id","question_id","attempt_sequence","schema_version");
CREATE UNIQUE INDEX "uq_learning_evidence_subject_sequence" ON "learning_evidence_events"("user_id","subject_code","event_sequence");
CREATE INDEX "idx_learning_evidence_user_subject_recorded" ON "learning_evidence_events"("user_id","subject_code","recorded_at");

CREATE TABLE "learning_evidence_outbox" (
  "id" TEXT PRIMARY KEY, "evidence_id" TEXT NOT NULL UNIQUE,
  "event_type" VARCHAR(80) NOT NULL DEFAULT 'learning.evidence.recorded.v1', "payload" JSONB NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending', "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimed_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3), "last_error_code" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_evidence_outbox_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "learning_evidence_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_evidence_outbox_attempt_check" CHECK ("attempt_count" >= 0)
);
CREATE INDEX "idx_learning_evidence_outbox_status_available" ON "learning_evidence_outbox"("status","available_at");

CREATE TABLE "user_csca_topic_states_v2" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "subject_code" VARCHAR(24) NOT NULL,
  "topic_id" INTEGER NOT NULL, "state_version" VARCHAR(80) NOT NULL, "model_version" VARCHAR(80) NOT NULL,
  "mastery" DOUBLE PRECISION NOT NULL, "confidence" DOUBLE PRECISION NOT NULL,
  "independence" DOUBLE PRECISION NOT NULL, "difficulty_ceiling" VARCHAR(40),
  "retention" DOUBLE PRECISION NOT NULL, "fluency" DOUBLE PRECISION NOT NULL,
  "transfer" DOUBLE PRECISION NOT NULL, "consistency" DOUBLE PRECISION NOT NULL,
  "coverage" DOUBLE PRECISION NOT NULL, "misconception_state" JSONB,
  "evidence_count" INTEGER NOT NULL DEFAULT 0, "last_evidence_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_csca_topic_states_v2_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_topic_state_subject_check" CHECK ("subject_code" IN ('math','physics','chemistry')),
  CONSTRAINT "user_topic_state_dimensions_check" CHECK ("mastery" BETWEEN 0 AND 1 AND "confidence" BETWEEN 0 AND 1 AND "independence" BETWEEN 0 AND 1 AND "retention" BETWEEN 0 AND 1 AND "fluency" BETWEEN 0 AND 1 AND "transfer" BETWEEN 0 AND 1 AND "consistency" BETWEEN 0 AND 1 AND "coverage" BETWEEN 0 AND 1),
  CONSTRAINT "user_topic_state_evidence_count_check" CHECK ("evidence_count" >= 0)
);
CREATE UNIQUE INDEX "uq_user_topic_state_v2_model" ON "user_csca_topic_states_v2"("user_id","subject_code","topic_id","model_version");
CREATE INDEX "idx_user_topic_state_v2_user_subject_updated" ON "user_csca_topic_states_v2"("user_id","subject_code","updated_at");

CREATE TABLE "learning_state_projection_checkpoints" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "subject_code" VARCHAR(24) NOT NULL,
  "projector_version" VARCHAR(80) NOT NULL, "last_event_sequence" BIGINT NOT NULL DEFAULT 0,
  "last_evidence_version" VARCHAR(80), "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_state_projection_checkpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_projection_sequence_check" CHECK ("last_event_sequence" >= 0)
);
CREATE UNIQUE INDEX "uq_learning_projection_checkpoint" ON "learning_state_projection_checkpoints"("user_id","subject_code","projector_version");

CREATE TABLE "target_gap_snapshots" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "goal_id" TEXT NOT NULL,
  "version_hash" VARCHAR(128) NOT NULL, "versions" JSONB NOT NULL, "gaps" JSONB NOT NULL,
  "evidence_cutoff_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "target_gap_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "target_gap_snapshots_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_target_gap_snapshot_versions" ON "target_gap_snapshots"("user_id","goal_id","version_hash");
CREATE INDEX "idx_target_gap_snapshots_user_created" ON "target_gap_snapshots"("user_id","created_at");

CREATE TABLE "learning_prescriptions" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "goal_id" TEXT NOT NULL,
  "version_hash" VARCHAR(128) NOT NULL, "versions" JSONB NOT NULL, "objective" TEXT NOT NULL,
  "reason_codes" JSONB NOT NULL DEFAULT '[]', "reason_summary" TEXT NOT NULL,
  "confidence" VARCHAR(24) NOT NULL, "estimated_minutes" INTEGER NOT NULL,
  "tasks" JSONB NOT NULL, "alternatives" JSONB NOT NULL DEFAULT '[]',
  "valid_until" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_prescriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_prescriptions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_prescriptions_minutes_check" CHECK ("estimated_minutes" > 0)
);
CREATE UNIQUE INDEX "uq_learning_prescription_versions" ON "learning_prescriptions"("user_id","goal_id","version_hash");
CREATE INDEX "idx_learning_prescriptions_user_valid" ON "learning_prescriptions"("user_id","valid_until");

CREATE TABLE "learning_prescription_outcomes" (
  "id" TEXT PRIMARY KEY, "prescription_id" TEXT NOT NULL, "user_id" INTEGER NOT NULL,
  "decision" VARCHAR(32) NOT NULL, "task_index" INTEGER, "domain_entity_type" VARCHAR(60),
  "domain_entity_id" VARCHAR(120), "metadata" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_prescription_outcomes_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "learning_prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_prescription_outcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_learning_prescription_outcomes_prescription" ON "learning_prescription_outcomes"("prescription_id","created_at");
CREATE INDEX "idx_learning_prescription_outcomes_user" ON "learning_prescription_outcomes"("user_id","created_at");

CREATE TABLE "assessment_item_exposures" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "item_type" VARCHAR(40) NOT NULL,
  "item_id" VARCHAR(120) NOT NULL, "item_version" VARCHAR(80) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL, "exposure_state" VARCHAR(32) NOT NULL,
  "first_exposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_exposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "assessment_item_exposures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_assessment_item_exposure" ON "assessment_item_exposures"("user_id","item_type","item_id","item_version");
CREATE INDEX "idx_assessment_item_exposure_user_subject_state" ON "assessment_item_exposures"("user_id","subject_code","exposure_state");

CREATE TABLE "score_readiness_forecasts" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "goal_id" TEXT NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL, "version_hash" VARCHAR(128) NOT NULL, "versions" JSONB NOT NULL,
  "expected_score_band" JSONB, "target_attainment_probability" DOUBLE PRECISION,
  "confidence" VARCHAR(24) NOT NULL, "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "next_validation_action" VARCHAR(40), "evidence_cutoff_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_readiness_forecasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "score_readiness_forecasts_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "score_readiness_probability_check" CHECK ("target_attainment_probability" IS NULL OR "target_attainment_probability" BETWEEN 0 AND 1)
);
CREATE UNIQUE INDEX "uq_score_readiness_forecast_versions" ON "score_readiness_forecasts"("user_id","goal_id","subject_code","version_hash");
CREATE INDEX "idx_score_readiness_forecasts_user_created" ON "score_readiness_forecasts"("user_id","created_at");

CREATE TABLE "agent_conversations" (
  "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'active',
  "title" VARCHAR(200), "last_message_at" TIMESTAMP(3), "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_agent_conversations_user_status_last" ON "agent_conversations"("user_id","status","last_message_at");

CREATE TABLE "agent_messages" (
  "id" TEXT PRIMARY KEY, "conversation_id" TEXT NOT NULL, "role" VARCHAR(24) NOT NULL,
  "content" JSONB NOT NULL, "client_message_id" VARCHAR(120), "run_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_agent_messages_client_id" ON "agent_messages"("conversation_id","client_message_id");
CREATE INDEX "idx_agent_messages_conversation_created" ON "agent_messages"("conversation_id","created_at");
CREATE INDEX "idx_agent_messages_run" ON "agent_messages"("run_id");

CREATE TABLE "agent_runs" (
  "id" TEXT PRIMARY KEY, "conversation_id" TEXT NOT NULL, "user_id" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'queued', "channel" VARCHAR(24) NOT NULL DEFAULT 'web',
  "trace_id" VARCHAR(80) NOT NULL UNIQUE, "input_snapshot" JSONB,
  "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_agent_runs_active_conversation" ON "agent_runs"("conversation_id") WHERE "status" IN ('queued','running','waiting_confirmation');
CREATE INDEX "idx_agent_runs_conversation_created" ON "agent_runs"("conversation_id","created_at");
CREATE INDEX "idx_agent_runs_user_status_created" ON "agent_runs"("user_id","status","created_at");

CREATE TABLE "agent_tool_calls" (
  "id" TEXT PRIMARY KEY, "run_id" TEXT NOT NULL, "user_id" INTEGER NOT NULL,
  "tool_name" VARCHAR(100) NOT NULL, "tool_version" VARCHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending', "idempotency_key_hash" VARCHAR(128),
  "input" JSONB NOT NULL, "output" JSONB, "error_code" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completed_at" TIMESTAMP(3),
  CONSTRAINT "agent_tool_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_tool_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_agent_tool_calls_idempotency" ON "agent_tool_calls"("user_id","tool_name","tool_version","idempotency_key_hash");
CREATE INDEX "idx_agent_tool_calls_run_created" ON "agent_tool_calls"("run_id","created_at");

CREATE TABLE "agent_artifacts" (
  "id" TEXT PRIMARY KEY, "conversation_id" TEXT NOT NULL, "run_id" TEXT NOT NULL, "user_id" INTEGER NOT NULL,
  "type" VARCHAR(60) NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "status" VARCHAR(24) NOT NULL DEFAULT 'ready',
  "title" VARCHAR(200) NOT NULL, "summary" TEXT, "domain_entity_type" VARCHAR(60),
  "domain_entity_id" VARCHAR(120), "route" VARCHAR(500), "snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_artifacts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_agent_artifacts_user_type_created" ON "agent_artifacts"("user_id","type","created_at");
CREATE INDEX "idx_agent_artifacts_domain_entity" ON "agent_artifacts"("domain_entity_type","domain_entity_id");

CREATE TABLE "agent_outbox" (
  "id" TEXT PRIMARY KEY, "conversation_id" TEXT, "run_id" TEXT, "event_type" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0, "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_outbox_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_outbox_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_agent_outbox_status_available" ON "agent_outbox"("status","available_at");
CREATE INDEX "idx_agent_outbox_run_created" ON "agent_outbox"("run_id","created_at");
