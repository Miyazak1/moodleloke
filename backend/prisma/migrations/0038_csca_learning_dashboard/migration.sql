CREATE TABLE "csca_learning_daily_snapshots" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "local_date" TIMESTAMP(3) NOT NULL,
  "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Shanghai',
  "subject" VARCHAR(60) NOT NULL DEFAULT 'all',
  "active_score" INTEGER NOT NULL DEFAULT 0,
  "answered_count" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "unanswered_count" INTEGER NOT NULL DEFAULT 0,
  "practice_seconds" INTEGER NOT NULL DEFAULT 0,
  "mock_seconds" INTEGER NOT NULL DEFAULT 0,
  "ai_interaction_count" INTEGER NOT NULL DEFAULT 0,
  "mastery_avg" DOUBLE PRECISION,
  "is_streak_eligible" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_learning_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_learning_streaks" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "current_streak_days" INTEGER NOT NULL DEFAULT 0,
  "longest_streak_days" INTEGER NOT NULL DEFAULT 0,
  "last_eligible_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_learning_streaks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_csca_learning_daily_user_date_subject" ON "csca_learning_daily_snapshots"("user_id", "local_date", "subject");
CREATE INDEX "idx_csca_learning_daily_user_date" ON "csca_learning_daily_snapshots"("user_id", "local_date");
CREATE UNIQUE INDEX "csca_learning_streaks_user_id_key" ON "csca_learning_streaks"("user_id");

ALTER TABLE "csca_learning_daily_snapshots"
  ADD CONSTRAINT "csca_learning_daily_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "csca_learning_streaks"
  ADD CONSTRAINT "csca_learning_streaks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
