CREATE TABLE "csca_readiness_action_calibration_snapshots" (
    "id" SERIAL NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "action_type" VARCHAR(80) NOT NULL,
    "window_days" INTEGER NOT NULL DEFAULT 30,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "followed_count" INTEGER NOT NULL DEFAULT 0,
    "ability_lift_count" INTEGER NOT NULL DEFAULT 0,
    "follow_through_rate" DOUBLE PRECISION,
    "ability_lift_rate" DOUBLE PRECISION,
    "average_mastery_delta" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" VARCHAR(40) NOT NULL DEFAULT 'insufficient',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csca_readiness_action_calibration_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_readiness_action_calibration_date_type" ON "csca_readiness_action_calibration_snapshots"("snapshot_date", "action_type");
CREATE INDEX "idx_readiness_action_calibration_type_date" ON "csca_readiness_action_calibration_snapshots"("action_type", "snapshot_date");
