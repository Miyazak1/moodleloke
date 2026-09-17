ALTER TABLE "student_profiles"
  ADD COLUMN IF NOT EXISTS "grade_code" VARCHAR(40);

CREATE INDEX IF NOT EXISTS "idx_student_profiles_grade_code"
  ON "student_profiles"("grade_code");

UPDATE "student_profiles"
SET "grade_code" = CASE
  WHEN lower(trim("grade")) IN ('g9', 'grade 9', 'year 10', 'igcse 1', 'pre-igcse') THEN 'INTL_G9'
  WHEN lower(trim("grade")) IN ('g10', 'grade 10', 'year 11', 'igcse 2', 'igcse') THEN 'INTL_G10'
  WHEN lower(trim("grade")) IN ('g11', 'grade 11', 'year 12', 'as', 'as level', 'ib dp1') THEN 'INTL_G11'
  WHEN lower(trim("grade")) IN ('g12', 'grade 12', 'year 13', 'a2', 'a level', 'ib dp2') THEN 'INTL_G12'
  WHEN lower(trim("grade")) IN ('foundation', '预科') THEN 'FOUNDATION'
  WHEN trim("grade") IN ('高一', '高中一年级') OR lower(trim("grade")) IN ('grade 10') THEN 'SCHOOL_G10'
  WHEN trim("grade") IN ('高二', '高中二年级') OR lower(trim("grade")) IN ('grade 11') THEN 'SCHOOL_G11'
  WHEN trim("grade") IN ('高三', '高中三年级') OR lower(trim("grade")) IN ('grade 12') THEN 'SCHOOL_G12'
  ELSE "grade_code"
END
WHERE "grade_code" IS NULL AND "grade" IS NOT NULL;
