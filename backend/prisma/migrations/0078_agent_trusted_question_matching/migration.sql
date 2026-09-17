CREATE TABLE "agent_attachment_question_matches" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "analysis_id" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "source_type" VARCHAR(48),
  "source_id" VARCHAR(120),
  "source_version" INTEGER,
  "source_title" VARCHAR(240),
  "subject_code" VARCHAR(24),
  "topic_id" INTEGER,
  "prompt_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "runner_up_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "extracted_prompt_hash" VARCHAR(64),
  "extracted_answer" VARCHAR(120),
  "correct_answer_hash" VARCHAR(64),
  "verified_outcome" VARCHAR(24),
  "matcher_version" VARCHAR(64) NOT NULL,
  "match_snapshot" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_attachment_question_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_attachment_question_matches_analysis_id_key" ON "agent_attachment_question_matches"("analysis_id");
CREATE INDEX "idx_agent_attachment_question_matches_user_status" ON "agent_attachment_question_matches"("user_id", "status", "created_at");
CREATE INDEX "idx_agent_attachment_question_matches_source" ON "agent_attachment_question_matches"("source_type", "source_id");

ALTER TABLE "agent_attachment_question_matches" ADD CONSTRAINT "agent_attachment_question_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_question_matches" ADD CONSTRAINT "agent_attachment_question_matches_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "agent_attachment_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
