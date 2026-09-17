CREATE TABLE "school_programs" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "name_zh" VARCHAR(240) NOT NULL,
  "name_en" VARCHAR(240),
  "degree_level" VARCHAR(80),
  "duration_years" VARCHAR(80),
  "field_category" VARCHAR(160),
  "teaching_language" VARCHAR(120),
  "csca_subjects" JSONB,
  "csca_requirement" TEXT,
  "hsk_requirement" TEXT,
  "english_requirement" TEXT,
  "tuition_amount" INTEGER,
  "tuition_currency" VARCHAR(12),
  "tuition_period" VARCHAR(80),
  "tuition_text" TEXT,
  "scholarship_text" TEXT,
  "source_url" TEXT,
  "source_label" VARCHAR(240),
  "last_verified_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_programs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_programs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_school_programs_school" ON "school_programs"("school_id");
CREATE INDEX "idx_school_programs_school_status_sort" ON "school_programs"("school_id", "status", "sort_order");
CREATE INDEX "idx_school_programs_degree_language" ON "school_programs"("degree_level", "teaching_language");
CREATE INDEX "idx_school_programs_status_updated" ON "school_programs"("status", "updated_at");
