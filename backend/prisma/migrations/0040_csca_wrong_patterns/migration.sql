CREATE TABLE "csca_wrong_patterns" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER,
  "pattern_type" VARCHAR(60) NOT NULL,
  "recurrence_count" INTEGER NOT NULL DEFAULT 1,
  "last_wrong_at" TIMESTAMP(3),
  "last_correct_at" TIMESTAMP(3),
  "next_review_at" TIMESTAMP(3),
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_wrong_patterns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_csca_wrong_patterns_user_subject_status" ON "csca_wrong_patterns"("user_id", "subject", "status");
CREATE INDEX "idx_csca_wrong_patterns_user_review" ON "csca_wrong_patterns"("user_id", "next_review_at");
CREATE INDEX "idx_csca_wrong_patterns_topic" ON "csca_wrong_patterns"("topic_id");

ALTER TABLE "csca_wrong_patterns"
  ADD CONSTRAINT "csca_wrong_patterns_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "csca_wrong_patterns"
  ADD CONSTRAINT "csca_wrong_patterns_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "csca_exam_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
