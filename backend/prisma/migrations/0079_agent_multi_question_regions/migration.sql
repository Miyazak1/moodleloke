CREATE TABLE "agent_attachment_analysis_items" (
  "id" TEXT NOT NULL,
  "analysis_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "subject_code" VARCHAR(24),
  "question_number" VARCHAR(80),
  "question_text" TEXT NOT NULL,
  "student_answer" VARCHAR(500),
  "assessment" VARCHAR(32) NOT NULL,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "guidance" JSONB NOT NULL DEFAULT '[]',
  "page_number" INTEGER,
  "region" JSONB,
  "citations" JSONB NOT NULL DEFAULT '[]',
  "uncertainty" VARCHAR(600),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_attachment_analysis_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agent_attachment_question_matches" ADD COLUMN "analysis_item_id" TEXT;
ALTER TABLE "agent_attachment_evidence_candidates" ADD COLUMN "analysis_item_id" TEXT;

DROP INDEX "agent_attachment_question_matches_analysis_id_key";
DROP INDEX "agent_attachment_evidence_candidates_analysis_id_key";

CREATE UNIQUE INDEX "uq_agent_attachment_analysis_items_ordinal" ON "agent_attachment_analysis_items"("analysis_id", "ordinal");
CREATE INDEX "idx_agent_attachment_analysis_items_user" ON "agent_attachment_analysis_items"("user_id", "created_at");
CREATE UNIQUE INDEX "agent_attachment_question_matches_analysis_item_id_key" ON "agent_attachment_question_matches"("analysis_item_id");
CREATE UNIQUE INDEX "agent_attachment_evidence_candidates_analysis_item_id_key" ON "agent_attachment_evidence_candidates"("analysis_item_id");
CREATE UNIQUE INDEX "uq_agent_attachment_question_matches_legacy" ON "agent_attachment_question_matches"("analysis_id") WHERE "analysis_item_id" IS NULL;
CREATE UNIQUE INDEX "uq_agent_attachment_evidence_candidates_legacy" ON "agent_attachment_evidence_candidates"("analysis_id") WHERE "analysis_item_id" IS NULL;
CREATE INDEX "idx_agent_attachment_question_matches_analysis" ON "agent_attachment_question_matches"("analysis_id");
CREATE INDEX "idx_agent_attachment_evidence_candidates_analysis" ON "agent_attachment_evidence_candidates"("analysis_id");

ALTER TABLE "agent_attachment_analysis_items" ADD CONSTRAINT "agent_attachment_analysis_items_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "agent_attachment_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_analysis_items" ADD CONSTRAINT "agent_attachment_analysis_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_question_matches" ADD CONSTRAINT "agent_attachment_question_matches_analysis_item_id_fkey" FOREIGN KEY ("analysis_item_id") REFERENCES "agent_attachment_analysis_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_evidence_candidates" ADD CONSTRAINT "agent_attachment_evidence_candidates_analysis_item_id_fkey" FOREIGN KEY ("analysis_item_id") REFERENCES "agent_attachment_analysis_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
