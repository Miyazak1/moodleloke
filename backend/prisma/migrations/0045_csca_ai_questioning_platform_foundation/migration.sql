ALTER TABLE "csca_exam_topics"
  ADD COLUMN IF NOT EXISTS "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "source_url" TEXT,
  ADD COLUMN IF NOT EXISTS "source_label" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verified_by" INTEGER,
  ADD COLUMN IF NOT EXISTS "allowed_question_types" JSONB,
  ADD COLUMN IF NOT EXISTS "difficulty_range" JSONB;

CREATE INDEX IF NOT EXISTS "idx_csca_exam_topics_subject_syllabus_status"
  ON "csca_exam_topics" ("subject", "syllabus_version", "status");

CREATE TABLE IF NOT EXISTS "csca_question_blueprints" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL REFERENCES "csca_exam_topics"("id") ON DELETE CASCADE,
  "difficulty" VARCHAR(40) NOT NULL,
  "question_type" VARCHAR(100) NOT NULL,
  "skill" VARCHAR(160),
  "source" VARCHAR(60) NOT NULL DEFAULT 'manual',
  "constraints" JSONB,
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_question_blueprints_subject_status"
  ON "csca_question_blueprints" ("subject", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_question_blueprints_topic_status"
  ON "csca_question_blueprints" ("topic_id", "status");

CREATE TABLE IF NOT EXISTS "csca_questions" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER NOT NULL REFERENCES "csca_exam_topics"("id") ON DELETE CASCADE,
  "blueprint_id" INTEGER REFERENCES "csca_question_blueprints"("id") ON DELETE SET NULL,
  "source_type" VARCHAR(60) NOT NULL,
  "source_question_id" INTEGER,
  "generated_variant_of" INTEGER,
  "designed_difficulty" VARCHAR(40) NOT NULL,
  "empirical_difficulty" VARCHAR(40),
  "difficulty_confidence" DOUBLE PRECISION,
  "question_type" VARCHAR(100) NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_answer" VARCHAR(50) NOT NULL,
  "explanation" TEXT NOT NULL,
  "knowledge_tags" JSONB NOT NULL DEFAULT '[]',
  "option_metadata" JSONB,
  "syllabus_version" VARCHAR(60) NOT NULL DEFAULT 'v1',
  "generation_metadata" JSONB,
  "review_metadata" JSONB,
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_questions_subject_status"
  ON "csca_questions" ("subject", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_questions_topic_status"
  ON "csca_questions" ("topic_id", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_questions_source"
  ON "csca_questions" ("source_type", "source_question_id");
CREATE INDEX IF NOT EXISTS "idx_csca_questions_syllabus_status"
  ON "csca_questions" ("syllabus_version", "status");

CREATE TABLE IF NOT EXISTS "csca_question_misconceptions" (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(140) NOT NULL UNIQUE,
  "subject" VARCHAR(60) NOT NULL,
  "topic_id" INTEGER REFERENCES "csca_exam_topics"("id") ON DELETE SET NULL,
  "label" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_question_misconceptions_subject_status"
  ON "csca_question_misconceptions" ("subject", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_question_misconceptions_topic"
  ON "csca_question_misconceptions" ("topic_id");

CREATE TABLE IF NOT EXISTS "csca_concept_cards" (
  "id" SERIAL PRIMARY KEY,
  "topic_id" INTEGER NOT NULL REFERENCES "csca_exam_topics"("id") ON DELETE CASCADE,
  "misconception_id" INTEGER REFERENCES "csca_question_misconceptions"("id") ON DELETE SET NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "example_json" JSONB,
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "source" VARCHAR(60) NOT NULL DEFAULT 'manual',
  "review_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_concept_cards_topic_status"
  ON "csca_concept_cards" ("topic_id", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_concept_cards_misconception_status"
  ON "csca_concept_cards" ("misconception_id", "status");

CREATE TABLE IF NOT EXISTS "csca_question_quality_metrics" (
  "id" SERIAL PRIMARY KEY,
  "question_id" INTEGER NOT NULL UNIQUE REFERENCES "csca_questions"("id") ON DELETE CASCADE,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "correct_rate" DOUBLE PRECISION,
  "median_seconds" INTEGER,
  "unanswered_rate" DOUBLE PRECISION,
  "marked_rate" DOUBLE PRECISION,
  "empirical_difficulty" VARCHAR(40),
  "difficulty_confidence" DOUBLE PRECISION,
  "needs_review" BOOLEAN NOT NULL DEFAULT false,
  "review_reason" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_question_quality_review"
  ON "csca_question_quality_metrics" ("needs_review", "updated_at");

CREATE TABLE IF NOT EXISTS "csca_ai_generation_jobs" (
  "id" SERIAL PRIMARY KEY,
  "blueprint_id" INTEGER NOT NULL REFERENCES "csca_question_blueprints"("id") ON DELETE CASCADE,
  "question_id" INTEGER REFERENCES "csca_questions"("id") ON DELETE SET NULL,
  "provider" VARCHAR(60),
  "model" VARCHAR(120),
  "request_hash" VARCHAR(120),
  "prompt_metadata" JSONB,
  "raw_output" JSONB,
  "normalized_output" JSONB,
  "review_result" JSONB,
  "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_ai_generation_jobs_blueprint_status"
  ON "csca_ai_generation_jobs" ("blueprint_id", "status");
CREATE INDEX IF NOT EXISTS "idx_csca_ai_generation_jobs_status_created"
  ON "csca_ai_generation_jobs" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(140) NOT NULL UNIQUE,
  "name" VARCHAR(200) NOT NULL,
  "type" VARCHAR(60) NOT NULL DEFAULT 'partner',
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_organizations_status_type"
  ON "organizations" ("status", "type");

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(60) NOT NULL DEFAULT 'student',
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_members_org_user"
  ON "organization_members" ("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_organization_members_user_status"
  ON "organization_members" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "organization_ai_credit_pools" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "available_credits" INTEGER NOT NULL DEFAULT 0,
  "reserved_credits" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "per_user_daily_limit" INTEGER,
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "organization_llm_provider_configs" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" VARCHAR(60) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "encrypted_api_key" TEXT NOT NULL,
  "base_url" TEXT,
  "status" VARCHAR(40) NOT NULL DEFAULT 'disabled',
  "usage_policy" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_org_llm_provider_configs_org_status"
  ON "organization_llm_provider_configs" ("organization_id", "status");
