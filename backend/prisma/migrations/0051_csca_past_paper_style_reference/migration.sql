-- CreateTable
CREATE TABLE "csca_source_documents" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(60) NOT NULL,
    "source_type" VARCHAR(60) NOT NULL DEFAULT 'past_paper',
    "title" VARCHAR(220) NOT NULL,
    "exam_year" INTEGER,
    "exam_session" VARCHAR(80),
    "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
    "file_hash" VARCHAR(140) NOT NULL,
    "storage_key" TEXT,
    "source_label" VARCHAR(220) NOT NULL,
    "source_url" TEXT,
    "license_scope" VARCHAR(80) NOT NULL DEFAULT 'internal_analysis',
    "usage_policy" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csca_source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csca_source_questions" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "subject" VARCHAR(60) NOT NULL,
    "question_number" VARCHAR(60) NOT NULL,
    "page_number" INTEGER,
    "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
    "prompt_hash" VARCHAR(140) NOT NULL,
    "prompt_text" TEXT,
    "options" JSONB,
    "correct_answer" VARCHAR(50),
    "explanation" TEXT,
    "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
    "topic_id" INTEGER,
    "topic_codes" JSONB NOT NULL DEFAULT '[]',
    "blueprint_like_tags" JSONB NOT NULL DEFAULT '[]',
    "analysis" JSONB NOT NULL DEFAULT '{}',
    "analysis_status" VARCHAR(40) NOT NULL DEFAULT 'ai_parsed',
    "analysis_confidence" DOUBLE PRECISION,
    "analysis_issues" JSONB NOT NULL DEFAULT '[]',
    "review_status" VARCHAR(40) NOT NULL DEFAULT 'parsed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csca_source_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csca_question_style_profiles" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(60) NOT NULL,
    "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
    "scope_type" VARCHAR(40) NOT NULL DEFAULT 'subject',
    "scope_id" INTEGER,
    "source_question_ids" JSONB NOT NULL DEFAULT '[]',
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "confidence" VARCHAR(40) NOT NULL DEFAULT 'low',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "profile_version" INTEGER NOT NULL DEFAULT 1,
    "source_question_snapshot_hash" VARCHAR(140) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
    "generated_by" VARCHAR(40) NOT NULL DEFAULT 'rule',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csca_question_style_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_csca_source_documents_subject_status" ON "csca_source_documents"("subject", "status");

-- CreateIndex
CREATE INDEX "idx_csca_source_documents_type_status" ON "csca_source_documents"("source_type", "status");

-- CreateIndex
CREATE INDEX "idx_csca_source_documents_file_hash" ON "csca_source_documents"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_csca_source_questions_document_number" ON "csca_source_questions"("document_id", "question_number");

-- CreateIndex
CREATE INDEX "idx_csca_source_questions_subject_syllabus" ON "csca_source_questions"("subject", "syllabus_version");

-- CreateIndex
CREATE INDEX "idx_csca_source_questions_topic_review" ON "csca_source_questions"("topic_id", "review_status");

-- CreateIndex
CREATE INDEX "idx_csca_source_questions_prompt_hash" ON "csca_source_questions"("prompt_hash");

-- CreateIndex
CREATE INDEX "idx_csca_style_profiles_scope_status" ON "csca_question_style_profiles"("subject", "syllabus_version", "scope_type", "status");

-- CreateIndex
CREATE INDEX "idx_csca_style_profiles_scope_id_status" ON "csca_question_style_profiles"("scope_id", "status");

-- AddForeignKey
ALTER TABLE "csca_source_questions" ADD CONSTRAINT "csca_source_questions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "csca_source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csca_source_questions" ADD CONSTRAINT "csca_source_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "csca_exam_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csca_question_style_profiles" ADD CONSTRAINT "csca_question_style_profiles_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "csca_exam_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
