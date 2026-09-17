ALTER TABLE "school_programs"
  ADD COLUMN "open_date" TIMESTAMP(3),
  ADD COLUMN "deadline_date" TIMESTAMP(3),
  ADD COLUMN "deadline_label" VARCHAR(160),
  ADD COLUMN "application_round" VARCHAR(120),
  ADD COLUMN "application_url" TEXT,
  ADD COLUMN "application_note" TEXT;

CREATE TABLE "school_csca_rules" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "program_id" INTEGER,
  "title" VARCHAR(240) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "scope" VARCHAR(240),
  "csca_subjects" JSONB,
  "language_condition" TEXT,
  "description" TEXT,
  "important_note" TEXT,
  "source_url" TEXT,
  "source_label" VARCHAR(240),
  "last_verified_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_csca_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_scholarships" (
  "id" SERIAL NOT NULL,
  "school_id" INTEGER NOT NULL,
  "program_id" INTEGER,
  "name" VARCHAR(240) NOT NULL,
  "type" VARCHAR(80) NOT NULL DEFAULT 'general',
  "coverage" TEXT,
  "applicable_degree" VARCHAR(160),
  "applicable_program" VARCHAR(240),
  "amount_text" TEXT,
  "requirement_text" TEXT,
  "source_url" TEXT,
  "source_label" VARCHAR(240),
  "last_verified_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_scholarships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_school_programs_deadline_status" ON "school_programs"("deadline_date", "status");
CREATE INDEX "idx_school_csca_rules_school_status_sort" ON "school_csca_rules"("school_id", "status", "sort_order");
CREATE INDEX "idx_school_csca_rules_program" ON "school_csca_rules"("program_id");
CREATE INDEX "idx_school_csca_rules_category_status" ON "school_csca_rules"("category", "status");
CREATE INDEX "idx_school_scholarships_school_status_sort" ON "school_scholarships"("school_id", "status", "sort_order");
CREATE INDEX "idx_school_scholarships_program" ON "school_scholarships"("program_id");
CREATE INDEX "idx_school_scholarships_type_status" ON "school_scholarships"("type", "status");

ALTER TABLE "school_csca_rules"
  ADD CONSTRAINT "school_csca_rules_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_csca_rules"
  ADD CONSTRAINT "school_csca_rules_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school_scholarships"
  ADD CONSTRAINT "school_scholarships_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_scholarships"
  ADD CONSTRAINT "school_scholarships_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
