CREATE TABLE "agent_past_paper_attempts" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "past_paper_id" INTEGER NOT NULL,
    "source_question_id" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'in_progress',
    "selected_answer" VARCHAR(500),
    "outcome" VARCHAR(24),
    "used_assistance" BOOLEAN NOT NULL DEFAULT false,
    "max_assistance_level" VARCHAR(8),
    "time_spent_seconds" INTEGER,
    "evidence_status" VARCHAR(40) NOT NULL DEFAULT 'pending',
    "evidence_reason_code" VARCHAR(80),
    "evidence_id" VARCHAR(120),
    "client_start_request_id" VARCHAR(120) NOT NULL,
    "client_submit_request_id" VARCHAR(120),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_past_paper_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_agent_past_paper_attempt_context" ON "agent_past_paper_attempts"("user_id", "conversation_id", "past_paper_id", "source_question_id");
CREATE UNIQUE INDEX "uq_agent_past_paper_attempt_start" ON "agent_past_paper_attempts"("user_id", "client_start_request_id");
CREATE UNIQUE INDEX "uq_agent_past_paper_attempt_submit" ON "agent_past_paper_attempts"("user_id", "client_submit_request_id");
CREATE INDEX "idx_agent_past_paper_attempt_user_status" ON "agent_past_paper_attempts"("user_id", "status", "updated_at");
CREATE INDEX "idx_agent_past_paper_attempt_conversation" ON "agent_past_paper_attempts"("conversation_id", "created_at");

ALTER TABLE "agent_past_paper_attempts" ADD CONSTRAINT "agent_past_paper_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_past_paper_attempts" ADD CONSTRAINT "agent_past_paper_attempts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_past_paper_attempts" ADD CONSTRAINT "agent_past_paper_attempts_past_paper_id_fkey" FOREIGN KEY ("past_paper_id") REFERENCES "past_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_past_paper_attempts" ADD CONSTRAINT "agent_past_paper_attempts_source_question_id_fkey" FOREIGN KEY ("source_question_id") REFERENCES "csca_source_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
