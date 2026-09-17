CREATE TABLE "student_exam_outcomes" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "exam_system_code" VARCHAR(40) NOT NULL DEFAULT 'csca',
  "subject_code" VARCHAR(24) NOT NULL,
  "exam_date" DATE NOT NULL,
  "exam_form_code" VARCHAR(80),
  "score" DOUBLE PRECISION NOT NULL,
  "scoring_policy_version" VARCHAR(80) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'submitted',
  "consent_purpose" VARCHAR(80) NOT NULL,
  "consent_version" VARCHAR(40) NOT NULL,
  "consented_at" TIMESTAMP(3) NOT NULL,
  "consent_withdrawn_at" TIMESTAMP(3),
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "verified_by_user_id" INTEGER,
  "verified_at" TIMESTAMP(3),
  "replaces_outcome_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_exam_outcomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_student_exam_outcome_system" CHECK ("exam_system_code" = 'csca'),
  CONSTRAINT "ck_student_exam_outcome_subject" CHECK ("subject_code" IN ('math','physics','chemistry')),
  CONSTRAINT "ck_student_exam_outcome_status" CHECK ("status" IN ('submitted','reviewed','verified','rejected','withdrawn','superseded')),
  CONSTRAINT "ck_student_exam_outcome_consent" CHECK ("consent_purpose" = 'score_calibration_and_product_improvement'),
  CONSTRAINT "ck_student_exam_outcome_review_state" CHECK (("status" NOT IN ('reviewed','verified')) OR ("reviewed_by_user_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  CONSTRAINT "ck_student_exam_outcome_verify_state" CHECK (("status" <> 'verified') OR ("verified_by_user_id" IS NOT NULL AND "verified_at" IS NOT NULL AND "verified_by_user_id" <> "reviewed_by_user_id"))
);

CREATE TABLE "student_exam_outcome_evidence" (
  "id" TEXT NOT NULL,
  "outcome_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "label" VARCHAR(120),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_exam_outcome_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_exam_outcome_events" (
  "id" TEXT NOT NULL,
  "outcome_id" TEXT NOT NULL,
  "actor_user_id" INTEGER NOT NULL,
  "actor_role" VARCHAR(24) NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "from_status" VARCHAR(24),
  "to_status" VARCHAR(24) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_exam_outcome_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_calibration_dataset_manifests" (
  "id" TEXT NOT NULL,
  "source_dataset_hash" VARCHAR(64) NOT NULL,
  "forecast_artifact_hash" VARCHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'active',
  "outcome_source" VARCHAR(32) NOT NULL DEFAULT 'verified_csca_exam',
  "exam_system_code" VARCHAR(40) NOT NULL,
  "subject_code" VARCHAR(24) NOT NULL,
  "scoring_policy_version" VARCHAR(80) NOT NULL,
  "item_calibration_version" VARCHAR(100) NOT NULL,
  "learner_key_version" VARCHAR(80) NOT NULL,
  "temporal_cutoff_date" DATE NOT NULL,
  "data_window_start" DATE NOT NULL,
  "data_window_end" DATE NOT NULL,
  "created_by_user_id" INTEGER NOT NULL,
  "invalidated_at" TIMESTAMP(3),
  "invalidation_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forecast_calibration_dataset_manifests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_forecast_dataset_manifest_status" CHECK ("status" IN ('active','invalidated')),
  CONSTRAINT "ck_forecast_dataset_manifest_source" CHECK ("outcome_source" = 'verified_csca_exam'),
  CONSTRAINT "ck_forecast_dataset_manifest_window" CHECK ("data_window_start" <= "temporal_cutoff_date" AND "temporal_cutoff_date" <= "data_window_end")
);

CREATE TABLE "forecast_calibration_dataset_rows" (
  "id" TEXT NOT NULL,
  "manifest_id" TEXT NOT NULL,
  "outcome_id" TEXT NOT NULL,
  "shadow_run_id" TEXT NOT NULL,
  "split" VARCHAR(16) NOT NULL,
  "learner_key_hash" VARCHAR(64) NOT NULL,
  "row_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forecast_calibration_dataset_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_forecast_dataset_row_split" CHECK ("split" IN ('calibration','holdout'))
);

ALTER TABLE "forecast_calibration_snapshots" ADD COLUMN "dataset_manifest_id" TEXT;

CREATE INDEX "idx_student_exam_outcomes_user_created" ON "student_exam_outcomes"("user_id", "created_at");
CREATE INDEX "idx_student_exam_outcomes_status_subject_exam" ON "student_exam_outcomes"("status", "subject_code", "exam_date");
CREATE INDEX "idx_student_exam_outcomes_policy_status" ON "student_exam_outcomes"("scoring_policy_version", "status");
CREATE INDEX "idx_student_exam_outcomes_replaces" ON "student_exam_outcomes"("replaces_outcome_id");
CREATE UNIQUE INDEX "uq_student_exam_outcome_evidence" ON "student_exam_outcome_evidence"("outcome_id", "attachment_id");
CREATE INDEX "idx_student_exam_outcome_evidence_attachment" ON "student_exam_outcome_evidence"("attachment_id");
CREATE INDEX "idx_student_exam_outcome_events_outcome" ON "student_exam_outcome_events"("outcome_id", "created_at");
CREATE INDEX "idx_student_exam_outcome_events_actor" ON "student_exam_outcome_events"("actor_user_id", "created_at");
CREATE UNIQUE INDEX "forecast_calibration_dataset_manifests_source_dataset_hash_key" ON "forecast_calibration_dataset_manifests"("source_dataset_hash");
CREATE INDEX "idx_forecast_dataset_manifests_status_subject" ON "forecast_calibration_dataset_manifests"("status", "subject_code", "created_at");
CREATE UNIQUE INDEX "uq_forecast_dataset_manifest_outcome" ON "forecast_calibration_dataset_rows"("manifest_id", "outcome_id");
CREATE UNIQUE INDEX "uq_forecast_dataset_manifest_learner" ON "forecast_calibration_dataset_rows"("manifest_id", "learner_key_hash");
CREATE INDEX "idx_forecast_dataset_rows_outcome" ON "forecast_calibration_dataset_rows"("outcome_id");
CREATE INDEX "idx_forecast_dataset_rows_shadow_run" ON "forecast_calibration_dataset_rows"("shadow_run_id");
CREATE INDEX "idx_forecast_calibration_dataset_manifest" ON "forecast_calibration_snapshots"("dataset_manifest_id");

ALTER TABLE "student_exam_outcomes" ADD CONSTRAINT "student_exam_outcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcomes" ADD CONSTRAINT "student_exam_outcomes_scoring_policy_version_fkey" FOREIGN KEY ("scoring_policy_version") REFERENCES "exam_scoring_policies"("policy_version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcomes" ADD CONSTRAINT "student_exam_outcomes_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcomes" ADD CONSTRAINT "student_exam_outcomes_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcomes" ADD CONSTRAINT "student_exam_outcomes_replaces_outcome_id_fkey" FOREIGN KEY ("replaces_outcome_id") REFERENCES "student_exam_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcome_evidence" ADD CONSTRAINT "student_exam_outcome_evidence_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "student_exam_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcome_evidence" ADD CONSTRAINT "student_exam_outcome_evidence_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcome_events" ADD CONSTRAINT "student_exam_outcome_events_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "student_exam_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_exam_outcome_events" ADD CONSTRAINT "student_exam_outcome_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_dataset_manifests" ADD CONSTRAINT "forecast_calibration_dataset_manifests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_dataset_rows" ADD CONSTRAINT "forecast_calibration_dataset_rows_manifest_id_fkey" FOREIGN KEY ("manifest_id") REFERENCES "forecast_calibration_dataset_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_dataset_rows" ADD CONSTRAINT "forecast_calibration_dataset_rows_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "student_exam_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_dataset_rows" ADD CONSTRAINT "forecast_calibration_dataset_rows_shadow_run_id_fkey" FOREIGN KEY ("shadow_run_id") REFERENCES "score_prediction_shadow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_snapshots_dataset_manifest_id_fkey" FOREIGN KEY ("dataset_manifest_id") REFERENCES "forecast_calibration_dataset_manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New verified snapshots must retain a live manifest. NOT VALID preserves legacy rows.
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "ck_forecast_verified_manifest_required"
  CHECK ("outcome_source" <> 'verified_csca_exam' OR "dataset_manifest_id" IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION "prevent_student_exam_outcome_event_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'student exam outcome audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_student_exam_outcome_events_append_only"
BEFORE UPDATE OR DELETE ON "student_exam_outcome_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_student_exam_outcome_event_mutation"();

CREATE OR REPLACE FUNCTION "prevent_exam_evidence_attachment_removal"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "student_exam_outcome_evidence" WHERE "attachment_id" = OLD."id") THEN
    RAISE EXCEPTION 'exam outcome evidence attachments cannot be removed or made unavailable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_exam_evidence_attachment_update_guard"
BEFORE UPDATE OF "status", "deleted_at", "storage_key" ON "agent_attachments"
FOR EACH ROW
WHEN (OLD."status" IS DISTINCT FROM NEW."status"
  OR OLD."deleted_at" IS DISTINCT FROM NEW."deleted_at"
  OR OLD."storage_key" IS DISTINCT FROM NEW."storage_key")
EXECUTE FUNCTION "prevent_exam_evidence_attachment_removal"();

CREATE TRIGGER "trg_exam_evidence_attachment_delete_guard"
BEFORE DELETE ON "agent_attachments"
FOR EACH ROW EXECUTE FUNCTION "prevent_exam_evidence_attachment_removal"();

CREATE OR REPLACE FUNCTION "guard_student_exam_outcome_identity"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."user_id" IS DISTINCT FROM NEW."user_id"
    OR OLD."exam_system_code" IS DISTINCT FROM NEW."exam_system_code"
    OR OLD."subject_code" IS DISTINCT FROM NEW."subject_code"
    OR OLD."exam_date" IS DISTINCT FROM NEW."exam_date"
    OR OLD."exam_form_code" IS DISTINCT FROM NEW."exam_form_code"
    OR OLD."score" IS DISTINCT FROM NEW."score"
    OR OLD."scoring_policy_version" IS DISTINCT FROM NEW."scoring_policy_version"
    OR OLD."consent_purpose" IS DISTINCT FROM NEW."consent_purpose"
    OR OLD."consent_version" IS DISTINCT FROM NEW."consent_version"
    OR OLD."consented_at" IS DISTINCT FROM NEW."consented_at"
    OR OLD."replaces_outcome_id" IS DISTINCT FROM NEW."replaces_outcome_id" THEN
    RAISE EXCEPTION 'student exam outcome facts are immutable; create a correction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_student_exam_outcome_identity_guard"
BEFORE UPDATE ON "student_exam_outcomes"
FOR EACH ROW EXECUTE FUNCTION "guard_student_exam_outcome_identity"();

CREATE OR REPLACE FUNCTION "prevent_forecast_dataset_row_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'forecast calibration dataset rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_forecast_dataset_rows_immutable"
BEFORE UPDATE OR DELETE ON "forecast_calibration_dataset_rows"
FOR EACH ROW EXECUTE FUNCTION "prevent_forecast_dataset_row_mutation"();

CREATE OR REPLACE FUNCTION "guard_forecast_dataset_manifest_identity"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."source_dataset_hash" IS DISTINCT FROM NEW."source_dataset_hash"
    OR OLD."forecast_artifact_hash" IS DISTINCT FROM NEW."forecast_artifact_hash"
    OR OLD."outcome_source" IS DISTINCT FROM NEW."outcome_source"
    OR OLD."exam_system_code" IS DISTINCT FROM NEW."exam_system_code"
    OR OLD."subject_code" IS DISTINCT FROM NEW."subject_code"
    OR OLD."scoring_policy_version" IS DISTINCT FROM NEW."scoring_policy_version"
    OR OLD."item_calibration_version" IS DISTINCT FROM NEW."item_calibration_version"
    OR OLD."learner_key_version" IS DISTINCT FROM NEW."learner_key_version"
    OR OLD."temporal_cutoff_date" IS DISTINCT FROM NEW."temporal_cutoff_date"
    OR OLD."data_window_start" IS DISTINCT FROM NEW."data_window_start"
    OR OLD."data_window_end" IS DISTINCT FROM NEW."data_window_end"
    OR OLD."created_by_user_id" IS DISTINCT FROM NEW."created_by_user_id"
    OR OLD."created_at" IS DISTINCT FROM NEW."created_at" THEN
    RAISE EXCEPTION 'forecast calibration dataset manifest identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_forecast_dataset_manifest_identity_guard"
BEFORE UPDATE ON "forecast_calibration_dataset_manifests"
FOR EACH ROW EXECUTE FUNCTION "guard_forecast_dataset_manifest_identity"();
