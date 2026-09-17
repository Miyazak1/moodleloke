CREATE TABLE "city_guides" (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "name_zh" VARCHAR(120) NOT NULL,
  "name_en" VARCHAR(120) NOT NULL,
  "region" VARCHAR(80) NOT NULL,
  "monthly_cost" INTEGER,
  "cost_level" VARCHAR(40),
  "density" VARCHAR(40),
  "tags" JSONB,
  "content_json" JSONB NOT NULL,
  "nearby" JSONB,
  "reference_school_count" INTEGER,
  "reference_program_count" INTEGER,
  "reference_english_program_count" INTEGER,
  "reference_scholarship_count" INTEGER,
  "reference_csca_school_count" INTEGER,
  "status" "SchoolStatus" NOT NULL DEFAULT 'draft',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_city_guides_status_sort" ON "city_guides"("status", "sort_order");
