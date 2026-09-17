ALTER TABLE "scholarships"
  ADD COLUMN "body_sections" JSONB,
  ADD COLUMN "benefit_items" JSONB,
  ADD COLUMN "eligibility_items" JSONB,
  ADD COLUMN "application_materials" JSONB,
  ADD COLUMN "application_steps" JSONB,
  ADD COLUMN "contact_info" JSONB,
  ADD COLUMN "action_links" JSONB;
