CREATE TABLE "agent_attachment_analyses" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "client_request_id" VARCHAR(120) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'queued',
  "intent" VARCHAR(48) NOT NULL DEFAULT 'student_work_review',
  "prompt_version" VARCHAR(48) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "gateway_request_id" VARCHAR(120),
  "model" VARCHAR(120),
  "input_snapshot" JSONB,
  "result" JSONB,
  "error_code" VARCHAR(80),
  "error_message" VARCHAR(500),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_attachment_analyses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_agent_attachment_analysis_request" ON "agent_attachment_analyses"("attachment_id", "client_request_id");
CREATE INDEX "idx_agent_attachment_analyses_user_status" ON "agent_attachment_analyses"("user_id", "status", "created_at");
CREATE INDEX "idx_agent_attachment_analyses_conversation" ON "agent_attachment_analyses"("conversation_id", "created_at");

ALTER TABLE "agent_attachment_analyses" ADD CONSTRAINT "agent_attachment_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_analyses" ADD CONSTRAINT "agent_attachment_analyses_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_analyses" ADD CONSTRAINT "agent_attachment_analyses_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
