CREATE TABLE IF NOT EXISTS "csca_syllabus_imports" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(60) NOT NULL,
  "syllabus_version" VARCHAR(60) NOT NULL,
  "source_label" VARCHAR(200),
  "source_url" TEXT,
  "status" VARCHAR(40) NOT NULL DEFAULT 'draft',
  "raw_json" JSONB NOT NULL,
  "preview_summary" JSONB,
  "applied_at" TIMESTAMP(3),
  "applied_by" INTEGER,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_csca_syllabus_import_subject_version_status"
  ON "csca_syllabus_imports" ("subject", "syllabus_version", "status");

CREATE INDEX IF NOT EXISTS "idx_csca_syllabus_import_status_created"
  ON "csca_syllabus_imports" ("status", "created_at");
