-- Independent scholarship catalog. Existing school_scholarships remains as
-- school-detail auxiliary data and is intentionally not migrated.
CREATE TABLE IF NOT EXISTS "scholarships" (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(260) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "type" VARCHAR(80) NOT NULL DEFAULT 'other',
  "funding_level" VARCHAR(40) NOT NULL DEFAULT 'unknown',
  "summary" TEXT,
  "coverage" TEXT,
  "applicable_degree" VARCHAR(160),
  "applicable_program" VARCHAR(240),
  "amount_text" TEXT,
  "requirement_text" TEXT,
  "target_countries" JSONB,
  "target_regions" JSONB,
  "benefits" JSONB,
  "source_url" TEXT,
  "source_label" VARCHAR(240),
  "last_verified_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "scholarships_slug_key" ON "scholarships"("slug");
CREATE INDEX IF NOT EXISTS "idx_scholarships_status_sort" ON "scholarships"("status", "sort_order");
CREATE INDEX IF NOT EXISTS "idx_scholarships_type_status" ON "scholarships"("type", "status");
CREATE INDEX IF NOT EXISTS "idx_scholarships_funding_status" ON "scholarships"("funding_level", "status");

CREATE TABLE IF NOT EXISTS "scholarship_schools" (
  "scholarship_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scholarship_schools_pkey" PRIMARY KEY ("scholarship_id", "school_id"),
  CONSTRAINT "scholarship_schools_scholarship_id_fkey" FOREIGN KEY ("scholarship_id") REFERENCES "scholarships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scholarship_schools_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_scholarship_schools_school" ON "scholarship_schools"("school_id");

CREATE TABLE IF NOT EXISTS "scholarship_programs" (
  "scholarship_id" INTEGER NOT NULL,
  "program_id" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scholarship_programs_pkey" PRIMARY KEY ("scholarship_id", "program_id"),
  CONSTRAINT "scholarship_programs_scholarship_id_fkey" FOREIGN KEY ("scholarship_id") REFERENCES "scholarships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scholarship_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "school_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_scholarship_programs_program" ON "scholarship_programs"("program_id");
