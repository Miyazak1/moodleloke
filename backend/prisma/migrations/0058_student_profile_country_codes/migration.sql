ALTER TABLE "student_profiles"
  ADD COLUMN "nationality_code" VARCHAR(2),
  ADD COLUMN "country_code" VARCHAR(2);

CREATE INDEX "idx_student_profiles_nationality_code" ON "student_profiles"("nationality_code");
CREATE INDEX "idx_student_profiles_country_code" ON "student_profiles"("country_code");

UPDATE "student_profiles"
SET
  "nationality_code" = CASE lower(trim("nationality"))
    WHEN 'china' THEN 'CN'
    WHEN '中国' THEN 'CN'
    WHEN 'vietnam' THEN 'VN'
    WHEN 'việt nam' THEN 'VN'
    WHEN '越南' THEN 'VN'
    ELSE "nationality_code"
  END,
  "country_code" = CASE lower(trim("country"))
    WHEN 'china' THEN 'CN'
    WHEN '中国' THEN 'CN'
    WHEN 'vietnam' THEN 'VN'
    WHEN 'việt nam' THEN 'VN'
    WHEN '越南' THEN 'VN'
    ELSE "country_code"
  END;
