CREATE TABLE IF NOT EXISTS "mock_exam_blueprints" (
  "id" SERIAL NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "syllabus_version" VARCHAR(80) NOT NULL DEFAULT 'current',
  "source_profile_ids" JSONB NOT NULL DEFAULT '[]',
  "source_paper_id" INTEGER,
  "question_count" INTEGER NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "total_score" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "profile" JSONB NOT NULL,
  "created_by" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_exam_blueprints_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mock_exam_blueprints_source_paper_id_fkey'
  ) THEN
    ALTER TABLE "mock_exam_blueprints"
      ADD CONSTRAINT "mock_exam_blueprints_source_paper_id_fkey"
      FOREIGN KEY ("source_paper_id") REFERENCES "mock_exam_papers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_mock_exam_blueprints_subject_status"
ON "mock_exam_blueprints"("subject", "status", "updated_at");

CREATE INDEX IF NOT EXISTS "idx_mock_exam_blueprints_source_paper"
ON "mock_exam_blueprints"("source_paper_id", "status");

CREATE TABLE IF NOT EXISTS "mock_exam_blueprint_slots" (
  "id" SERIAL NOT NULL,
  "blueprint_id" INTEGER NOT NULL,
  "slot_number" INTEGER NOT NULL,
  "topic_ids" JSONB NOT NULL DEFAULT '[]',
  "module" VARCHAR(160),
  "difficulty_band" VARCHAR(40) NOT NULL DEFAULT 'medium',
  "cognitive_skill" VARCHAR(80) NOT NULL DEFAULT 'unknown',
  "reading_load" VARCHAR(40) NOT NULL DEFAULT 'medium',
  "calculation_load" VARCHAR(40) NOT NULL DEFAULT 'light',
  "estimated_time_seconds" INTEGER NOT NULL DEFAULT 75,
  "generation_prompt_hints" JSONB NOT NULL DEFAULT '[]',
  "reviewer_checklist" JSONB NOT NULL DEFAULT '[]',
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_exam_blueprint_slots_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mock_exam_blueprint_slots_blueprint_id_fkey'
  ) THEN
    ALTER TABLE "mock_exam_blueprint_slots"
      ADD CONSTRAINT "mock_exam_blueprint_slots_blueprint_id_fkey"
      FOREIGN KEY ("blueprint_id") REFERENCES "mock_exam_blueprints"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_mock_exam_blueprint_slots_blueprint_slot"
ON "mock_exam_blueprint_slots"("blueprint_id", "slot_number");

CREATE INDEX IF NOT EXISTS "idx_mock_exam_blueprint_slots_blueprint_status"
ON "mock_exam_blueprint_slots"("blueprint_id", "status");

CREATE TABLE IF NOT EXISTS "mock_exam_generation_jobs" (
  "id" SERIAL NOT NULL,
  "blueprint_id" INTEGER NOT NULL,
  "target_paper_id" INTEGER,
  "status" VARCHAR(40) NOT NULL DEFAULT 'queued',
  "provider" VARCHAR(80),
  "model" VARCHAR(120),
  "requested_slot_numbers" JSONB NOT NULL DEFAULT '[]',
  "slot_results" JSONB NOT NULL DEFAULT '[]',
  "error" TEXT,
  "created_by" INTEGER,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_exam_generation_jobs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mock_exam_generation_jobs_blueprint_id_fkey'
  ) THEN
    ALTER TABLE "mock_exam_generation_jobs"
      ADD CONSTRAINT "mock_exam_generation_jobs_blueprint_id_fkey"
      FOREIGN KEY ("blueprint_id") REFERENCES "mock_exam_blueprints"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_mock_exam_generation_jobs_blueprint_status"
ON "mock_exam_generation_jobs"("blueprint_id", "status", "updated_at");

CREATE INDEX IF NOT EXISTS "idx_mock_exam_generation_jobs_status"
ON "mock_exam_generation_jobs"("status", "updated_at");
