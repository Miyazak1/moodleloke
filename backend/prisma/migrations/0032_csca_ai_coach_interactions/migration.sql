CREATE TABLE "csca_ai_interactions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "subject" VARCHAR(60),
  "topic_id" INTEGER,
  "question_id" INTEGER,
  "session_id" INTEGER,
  "round_id" INTEGER,
  "type" VARCHAR(60) NOT NULL,
  "provider" VARCHAR(60),
  "model" VARCHAR(120),
  "prompt_version" VARCHAR(60),
  "input_hash" VARCHAR(120),
  "output" TEXT,
  "token_usage" JSONB,
  "cost_estimate" DOUBLE PRECISION,
  "status" VARCHAR(40) NOT NULL DEFAULT 'success',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_ai_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_ai_interaction_feedback" (
  "id" SERIAL NOT NULL,
  "interaction_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "rating" INTEGER NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_ai_interaction_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_csca_ai_interactions_user_created" ON "csca_ai_interactions"("user_id", "created_at");
CREATE INDEX "idx_csca_ai_interactions_round" ON "csca_ai_interactions"("round_id");
CREATE INDEX "idx_csca_ai_interactions_question" ON "csca_ai_interactions"("question_id");
CREATE INDEX "idx_csca_ai_feedback_interaction" ON "csca_ai_interaction_feedback"("interaction_id");
CREATE INDEX "idx_csca_ai_feedback_user_created" ON "csca_ai_interaction_feedback"("user_id", "created_at");

ALTER TABLE "csca_ai_interaction_feedback"
  ADD CONSTRAINT "csca_ai_interaction_feedback_interaction_id_fkey"
  FOREIGN KEY ("interaction_id") REFERENCES "csca_ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
