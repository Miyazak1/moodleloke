ALTER TABLE "organization_members"
  ADD COLUMN IF NOT EXISTS "cohort_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "invited_by" INTEGER,
  ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "organization_cohorts" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_cohorts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_cohorts_org_slug"
  ON "organization_cohorts" ("organization_id", "slug");

CREATE INDEX IF NOT EXISTS "idx_organization_cohorts_org_status"
  ON "organization_cohorts" ("organization_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_cohort_id_fkey'
  ) THEN
    ALTER TABLE "organization_members"
      ADD CONSTRAINT "organization_members_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "organization_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_organization_members_org_cohort_status"
  ON "organization_members" ("organization_id", "cohort_id", "status");

CREATE TABLE IF NOT EXISTS "organization_invites" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL,
  "cohort_id" INTEGER,
  "email" VARCHAR(255),
  "role" VARCHAR(60) NOT NULL DEFAULT 'student',
  "token_hash" VARCHAR(120) NOT NULL UNIQUE,
  "status" VARCHAR(40) NOT NULL DEFAULT 'pending',
  "max_uses" INTEGER NOT NULL DEFAULT 1,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "created_by" INTEGER,
  "accepted_by" INTEGER,
  "accepted_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invites_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_invites_cohort_id_fkey"
    FOREIGN KEY ("cohort_id") REFERENCES "organization_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_organization_invites_org_status"
  ON "organization_invites" ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "idx_organization_invites_email_status"
  ON "organization_invites" ("email", "status");
