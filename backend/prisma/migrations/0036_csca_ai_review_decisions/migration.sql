CREATE TABLE "csca_ai_review_decisions" (
  "id" SERIAL NOT NULL,
  "interaction_id" INTEGER NOT NULL,
  "actor_id" INTEGER,
  "decision" VARCHAR(60) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'posted',
  "note" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_ai_review_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_csca_ai_review_decisions_interaction_created" ON "csca_ai_review_decisions"("interaction_id", "created_at");
CREATE INDEX "idx_csca_ai_review_decisions_actor_created" ON "csca_ai_review_decisions"("actor_id", "created_at");
CREATE INDEX "idx_csca_ai_review_decisions_decision_created" ON "csca_ai_review_decisions"("decision", "created_at");

ALTER TABLE "csca_ai_review_decisions"
  ADD CONSTRAINT "csca_ai_review_decisions_interaction_id_fkey"
  FOREIGN KEY ("interaction_id") REFERENCES "csca_ai_interactions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
