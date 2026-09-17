-- LS-V1 PR 4: compare-and-set publication pointer for immutable Gap and Prescription snapshots.
CREATE TABLE "learning_decision_current" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "goal_id" TEXT NOT NULL,
  "version_hash" VARCHAR(128) NOT NULL,
  "gap_snapshot_id" TEXT NOT NULL,
  "prescription_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_decision_current_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_decision_current_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "student_score_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_decision_current_gap_snapshot_id_fkey" FOREIGN KEY ("gap_snapshot_id") REFERENCES "target_gap_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_decision_current_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "learning_prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_decision_current_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "learning_decision_current_goal_id_key" ON "learning_decision_current"("goal_id");
CREATE INDEX "idx_learning_decision_current_user_updated" ON "learning_decision_current"("user_id", "updated_at");
