ALTER TABLE "scholarships"
  ADD COLUMN "deadline_date" TIMESTAMP(3),
  ADD COLUMN "deadline_label" VARCHAR(160),
  ADD COLUMN "application_round" VARCHAR(120);

CREATE INDEX "idx_scholarships_deadline_status" ON "scholarships"("deadline_date", "status");
