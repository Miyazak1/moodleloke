ALTER TABLE "exam_scoring_policies" ADD COLUMN "created_by_user_id" INTEGER;
ALTER TABLE "item_calibration_snapshots" ADD COLUMN "created_by_user_id" INTEGER;
ALTER TABLE "forecast_calibration_snapshots" ADD COLUMN "created_by_user_id" INTEGER;

ALTER TABLE "exam_scoring_policies" ADD CONSTRAINT "exam_scoring_policies_independent_review_check"
  CHECK ("created_by_user_id" IS NULL OR "reviewed_by_user_id" IS NULL OR "created_by_user_id" <> "reviewed_by_user_id");
ALTER TABLE "item_calibration_snapshots" ADD CONSTRAINT "item_calibration_independent_review_check"
  CHECK ("created_by_user_id" IS NULL OR "reviewed_by_user_id" IS NULL OR "created_by_user_id" <> "reviewed_by_user_id");
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_independent_review_check"
  CHECK ("created_by_user_id" IS NULL OR "reviewed_by_user_id" IS NULL OR "created_by_user_id" <> "reviewed_by_user_id");

CREATE INDEX "idx_exam_scoring_policies_creator" ON "exam_scoring_policies"("created_by_user_id", "created_at");
CREATE INDEX "idx_item_calibration_creator" ON "item_calibration_snapshots"("created_by_user_id", "created_at");
CREATE INDEX "idx_forecast_calibration_creator" ON "forecast_calibration_snapshots"("created_by_user_id", "created_at");

ALTER TABLE "exam_scoring_policies" ADD CONSTRAINT "exam_scoring_policies_creator_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_calibration_snapshots" ADD CONSTRAINT "item_calibration_snapshots_creator_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecast_calibration_snapshots" ADD CONSTRAINT "forecast_calibration_snapshots_creator_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "score_calibration_governance_events" (
  "id" TEXT NOT NULL,
  "resource_type" VARCHAR(40) NOT NULL,
  "resource_id" VARCHAR(120) NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "from_status" VARCHAR(24),
  "to_status" VARCHAR(24) NOT NULL,
  "actor_user_id" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_calibration_governance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "score_calibration_events_resource_type_check" CHECK ("resource_type" IN ('scoring_policy', 'item_calibration', 'forecast_calibration')),
  CONSTRAINT "score_calibration_events_reason_check" CHECK (char_length(trim("reason")) >= 8)
);

CREATE INDEX "idx_score_calibration_events_resource" ON "score_calibration_governance_events"("resource_type", "resource_id", "created_at");
CREATE INDEX "idx_score_calibration_events_actor" ON "score_calibration_governance_events"("actor_user_id", "created_at");
ALTER TABLE "score_calibration_governance_events" ADD CONSTRAINT "score_calibration_events_actor_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_score_calibration_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'score calibration governance events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "score_calibration_events_no_update"
  BEFORE UPDATE OR DELETE ON "score_calibration_governance_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_score_calibration_event_mutation"();
