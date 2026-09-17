ALTER TABLE "student_profiles"
  ADD COLUMN IF NOT EXISTS "gender_code" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "education_stage_code" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "graduation_year" INTEGER,
  ADD COLUMN IF NOT EXISTS "target_exam_date" DATE,
  ADD COLUMN IF NOT EXISTS "target_subject_codes" JSONB,
  ADD COLUMN IF NOT EXISTS "preferred_question_language_code" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "exam_attempt_type" VARCHAR(24),
  ADD COLUMN IF NOT EXISTS "weekly_goal_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "target_major_category_code" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboarding_skipped_at" TIMESTAMP(3);

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_graduation_year_check"
    CHECK ("graduation_year" IS NULL OR "graduation_year" BETWEEN 2020 AND 2100),
  ADD CONSTRAINT "student_profiles_weekly_goal_days_check"
    CHECK ("weekly_goal_days" IS NULL OR "weekly_goal_days" BETWEEN 1 AND 7);
