CREATE TABLE "csca_exam_topics" (
  "id" SERIAL NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "module" VARCHAR(120),
  "code" VARCHAR(140) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "exam_scope" TEXT,
  "parent_id" INTEGER,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_exam_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_topic_mappings" (
  "id" SERIAL NOT NULL,
  "source_type" VARCHAR(60) NOT NULL,
  "source_id" INTEGER NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_topic_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "csca_exam_topics_code_key" ON "csca_exam_topics"("code");
CREATE INDEX "idx_csca_exam_topics_subject_status" ON "csca_exam_topics"("subject", "status");
CREATE INDEX "idx_csca_exam_topics_module_status" ON "csca_exam_topics"("module", "status");
CREATE UNIQUE INDEX "uq_csca_topic_mappings_source_topic" ON "csca_topic_mappings"("source_type", "source_id", "topic_id");
CREATE INDEX "idx_csca_topic_mappings_source" ON "csca_topic_mappings"("source_type", "source_id");
CREATE INDEX "idx_csca_topic_mappings_topic" ON "csca_topic_mappings"("topic_id");

ALTER TABLE "csca_topic_mappings"
  ADD CONSTRAINT "csca_topic_mappings_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "csca_exam_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
