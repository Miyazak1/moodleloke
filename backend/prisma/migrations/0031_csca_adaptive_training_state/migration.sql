CREATE TABLE "user_csca_topic_mastery" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "last_practiced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_csca_topic_mastery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_adaptive_sessions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "mode" VARCHAR(40) NOT NULL DEFAULT 'practice',
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_adaptive_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_adaptive_rounds" (
  "id" SERIAL NOT NULL,
  "session_id" INTEGER NOT NULL,
  "round_index" INTEGER NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "planner_snapshot" JSONB,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "time_spent" JSONB NOT NULL DEFAULT '{}',
  "current_question" INTEGER NOT NULL DEFAULT 1,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "unanswered_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_adaptive_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_adaptive_round_items" (
  "id" SERIAL NOT NULL,
  "round_id" INTEGER NOT NULL,
  "question_id" INTEGER NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "planned_difficulty" VARCHAR(40),
  "position" INTEGER NOT NULL,
  "selected_answer" VARCHAR(50),
  "is_correct" BOOLEAN,
  "used_hint" BOOLEAN NOT NULL DEFAULT false,
  "used_explanation" BOOLEAN NOT NULL DEFAULT false,
  "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_adaptive_round_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_question_exposures" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "question_id" INTEGER NOT NULL,
  "source" VARCHAR(60) NOT NULL,
  "seen_count" INTEGER NOT NULL DEFAULT 1,
  "last_result" VARCHAR(40),
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_question_exposures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_user_csca_topic_mastery_user_topic" ON "user_csca_topic_mastery"("user_id", "topic_id");
CREATE INDEX "idx_user_csca_topic_mastery_user_subject" ON "user_csca_topic_mastery"("user_id", "subject");
CREATE INDEX "idx_user_csca_topic_mastery_topic" ON "user_csca_topic_mastery"("topic_id");

CREATE INDEX "idx_csca_adaptive_sessions_user_subject_created" ON "csca_adaptive_sessions"("user_id", "subject", "created_at");
CREATE INDEX "idx_csca_adaptive_sessions_user_status" ON "csca_adaptive_sessions"("user_id", "status");

CREATE UNIQUE INDEX "uq_csca_adaptive_round_session_index" ON "csca_adaptive_rounds"("session_id", "round_index");
CREATE INDEX "idx_csca_adaptive_rounds_session_created" ON "csca_adaptive_rounds"("session_id", "created_at");

CREATE UNIQUE INDEX "uq_csca_adaptive_round_items_round_question" ON "csca_adaptive_round_items"("round_id", "question_id");
CREATE INDEX "idx_csca_adaptive_round_items_round_position" ON "csca_adaptive_round_items"("round_id", "position");
CREATE INDEX "idx_csca_adaptive_round_items_question" ON "csca_adaptive_round_items"("question_id");
CREATE INDEX "idx_csca_adaptive_round_items_topic" ON "csca_adaptive_round_items"("topic_id");

CREATE UNIQUE INDEX "uq_csca_question_exposures_user_question_source" ON "csca_question_exposures"("user_id", "question_id", "source");
CREATE INDEX "idx_csca_question_exposures_user_seen" ON "csca_question_exposures"("user_id", "last_seen_at");
CREATE INDEX "idx_csca_question_exposures_question" ON "csca_question_exposures"("question_id");

ALTER TABLE "csca_adaptive_rounds"
  ADD CONSTRAINT "csca_adaptive_rounds_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "csca_adaptive_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "csca_adaptive_round_items"
  ADD CONSTRAINT "csca_adaptive_round_items_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "csca_adaptive_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
