ALTER TABLE "student_profiles"
  ADD COLUMN "current_organization_id" INTEGER;

CREATE INDEX "idx_student_profiles_current_organization" ON "student_profiles"("current_organization_id");
