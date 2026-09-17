CREATE TABLE "learning_evidence_retractions" (
  "id" TEXT NOT NULL,
  "evidence_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "reason_code" VARCHAR(80) NOT NULL,
  "reason" VARCHAR(500),
  "client_request_id" VARCHAR(120) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_evidence_retractions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_attachment_evidence_candidates" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "analysis_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
  "subject_code" VARCHAR(24),
  "suggested_topic_id" INTEGER,
  "confirmed_topic_id" INTEGER,
  "outcome" VARCHAR(24),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gate_reasons" JSONB NOT NULL DEFAULT '[]',
  "source_snapshot" JSONB NOT NULL,
  "evidence_id" TEXT,
  "decision_before" JSONB,
  "decision_after" JSONB,
  "confirmed_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_attachment_evidence_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_evidence_retractions_evidence_id_key" ON "learning_evidence_retractions"("evidence_id");
CREATE UNIQUE INDEX "uq_learning_evidence_retraction_request" ON "learning_evidence_retractions"("user_id", "client_request_id");
CREATE INDEX "idx_learning_evidence_retractions_user_created" ON "learning_evidence_retractions"("user_id", "created_at");
CREATE UNIQUE INDEX "agent_attachment_evidence_candidates_analysis_id_key" ON "agent_attachment_evidence_candidates"("analysis_id");
CREATE UNIQUE INDEX "agent_attachment_evidence_candidates_evidence_id_key" ON "agent_attachment_evidence_candidates"("evidence_id");
CREATE INDEX "idx_agent_attachment_evidence_candidates_user_status" ON "agent_attachment_evidence_candidates"("user_id", "status", "created_at");
CREATE INDEX "idx_agent_attachment_evidence_candidates_conversation" ON "agent_attachment_evidence_candidates"("conversation_id", "created_at");

ALTER TABLE "learning_evidence_retractions" ADD CONSTRAINT "learning_evidence_retractions_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "learning_evidence_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_evidence_retractions" ADD CONSTRAINT "learning_evidence_retractions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "agent_attachment_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "learning_evidence_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
