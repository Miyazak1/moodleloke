CREATE TABLE IF NOT EXISTS "csca_exam_series_profiles" (
  "id" SERIAL NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
  "title" VARCHAR(220) NOT NULL,
  "source_document_ids" JSONB NOT NULL DEFAULT '[]',
  "source_style_profile_ids" JSONB NOT NULL DEFAULT '[]',
  "source_question_ids" JSONB NOT NULL DEFAULT '[]',
  "session_summary" JSONB NOT NULL DEFAULT '{}',
  "trend_profile" JSONB NOT NULL DEFAULT '{}',
  "sample_size" INTEGER NOT NULL DEFAULT 0,
  "confidence" VARCHAR(40) NOT NULL DEFAULT 'low',
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "generated_by" VARCHAR(40) NOT NULL DEFAULT 'rule',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_exam_series_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "csca_generation_profiles" (
  "id" SERIAL NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
  "use_case" VARCHAR(60) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "series_profile_id" INTEGER,
  "source_style_profile_id" INTEGER,
  "profile" JSONB NOT NULL DEFAULT '{}',
  "target_policy" JSONB NOT NULL DEFAULT '{}',
  "sample_size" INTEGER NOT NULL DEFAULT 0,
  "confidence" VARCHAR(40) NOT NULL DEFAULT 'low',
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "generated_by" VARCHAR(40) NOT NULL DEFAULT 'rule',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_generation_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_csca_exam_series_profiles_subject_status"
  ON "csca_exam_series_profiles"("subject", "syllabus_version", "status");

CREATE INDEX IF NOT EXISTS "idx_csca_exam_series_profiles_status_generated"
  ON "csca_exam_series_profiles"("status", "generated_at");

CREATE INDEX IF NOT EXISTS "idx_csca_generation_profiles_use_case_status"
  ON "csca_generation_profiles"("subject", "syllabus_version", "use_case", "status");

CREATE INDEX IF NOT EXISTS "idx_csca_generation_profiles_series_status"
  ON "csca_generation_profiles"("series_profile_id", "status");
