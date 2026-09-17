CREATE UNIQUE INDEX IF NOT EXISTS "uniq_csca_exam_series_profiles_active"
  ON "csca_exam_series_profiles"("subject", "syllabus_version")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_csca_generation_profiles_active"
  ON "csca_generation_profiles"("subject", "syllabus_version", "use_case")
  WHERE "status" = 'active';
