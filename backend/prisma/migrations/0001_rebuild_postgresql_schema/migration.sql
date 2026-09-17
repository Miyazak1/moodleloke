-- CSCAlite rebuild baseline.
-- PostgreSQL is the target database. The school model keeps the field semantics
-- from D:\工作文件\国内大学信息收集\backend\init-db.js while using Prisma-managed tables.

CREATE TYPE "UserRole" AS ENUM ('student', 'advisor', 'admin');
CREATE TYPE "SchoolType" AS ENUM ('regular', 'partner');
CREATE TYPE "SchoolStatus" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "login_name" VARCHAR(50) UNIQUE,
  "email" VARCHAR(255) UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'student',
  "display_name" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "content_blocks" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "body_json" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'published',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "schools_raw" (
  "id" SERIAL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "source_id" TEXT,
  "payload" JSONB NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3)
);

CREATE TABLE "schools" (
  "id" SERIAL PRIMARY KEY,
  "name_zh" VARCHAR(200) NOT NULL,
  "name_en" VARCHAR(200),
  "rank" INTEGER,
  "school_type" "SchoolType" NOT NULL,
  "guaranteed_admission" BOOLEAN NOT NULL DEFAULT false,
  "tier_en" TEXT,
  "region" TEXT,
  "logo_url" TEXT,
  "official_website" TEXT,
  "application_system_url" TEXT,
  "admission_level" JSONB,
  "hsk_requirement" TEXT,
  "hsk_notes" TEXT,
  "csca_requirement" TEXT,
  "csca_required" BOOLEAN NOT NULL DEFAULT false,
  "csca_requirement_note" TEXT,
  "undergrad_requirements" TEXT,
  "postgrad_requirements" TEXT,
  "preparatory_requirements" TEXT,
  "language_of_instruction" JSONB,
  "hsk_min_level" INTEGER,
  "hsk_chinese_min_level" INTEGER,
  "hsk_chinese_min_listening" INTEGER,
  "hsk_chinese_min_reading" INTEGER,
  "hsk_chinese_min_writing" INTEGER,
  "hsk_chinese_conditional" TEXT,
  "hsk_english_required" BOOLEAN NOT NULL DEFAULT false,
  "hskk_required" BOOLEAN NOT NULL DEFAULT false,
  "hskk_chinese_min_level" TEXT,
  "hskk_chinese_conditional" TEXT,
  "english_required" BOOLEAN NOT NULL DEFAULT false,
  "english_min_ielts" DOUBLE PRECISION,
  "english_min_toefl" INTEGER,
  "english_requirement_note" TEXT,
  "round1_deadline" TEXT,
  "round2_deadline" TEXT,
  "round1_open_date" TEXT,
  "round1_close_date" TEXT,
  "round2_open_date" TEXT,
  "round2_close_date" TEXT,
  "application_steps" TEXT,
  "tuition_summary" TEXT,
  "tuition_by_category" JSONB,
  "application_fee" TEXT,
  "insurance" TEXT,
  "accommodation_cost" TEXT,
  "accommodation_type" TEXT,
  "scholarships" JSONB,
  "english_programs" TEXT,
  "notable_programs" TEXT,
  "campus_facilities" TEXT,
  "program_fields" TEXT,
  "contact_tel" TEXT,
  "contact_email" TEXT,
  "contact_address" TEXT,
  "year_established" INTEGER,
  "student_count" TEXT,
  "students_served" INTEGER,
  "under_18_guardian_required" BOOLEAN NOT NULL DEFAULT false,
  "under_18_requirement_note" TEXT,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "source" TEXT,
  "source_id" TEXT,
  "source_url" TEXT,
  "data_quality_score" INTEGER,
  "last_verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "school_change_logs" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "actor_id" INTEGER,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "school_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_users_role" ON "users"("role");
CREATE INDEX "idx_content_blocks_status_sort" ON "content_blocks"("status", "sort_order");
CREATE INDEX "idx_schools_raw_source" ON "schools_raw"("source", "source_id");
CREATE INDEX "idx_schools_status_rank" ON "schools"("status", "rank");
CREATE INDEX "idx_schools_type_region" ON "schools"("school_type", "region");
CREATE INDEX "idx_schools_csca_hsk" ON "schools"("csca_required", "hsk_min_level");
CREATE INDEX "idx_schools_deadline" ON "schools"("round1_deadline", "round2_deadline");
CREATE INDEX "idx_schools_name_zh" ON "schools"("name_zh");
CREATE INDEX "idx_schools_name_en" ON "schools"("name_en");
CREATE INDEX "idx_school_change_logs_school_created" ON "school_change_logs"("school_id", "created_at");
CREATE UNIQUE INDEX "uq_school_snapshots_school_version" ON "school_snapshots"("school_id", "version");

-- Optional PostgreSQL search optimization for the recovered school library.
-- Enable in an environment where extensions are allowed:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX "idx_schools_name_zh_trgm" ON "schools" USING gin ("name_zh" gin_trgm_ops);
-- CREATE INDEX "idx_schools_program_fields_trgm" ON "schools" USING gin ("program_fields" gin_trgm_ops);
