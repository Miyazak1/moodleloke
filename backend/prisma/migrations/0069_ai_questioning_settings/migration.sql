CREATE TABLE IF NOT EXISTS "csca_ai_questioning_settings" (
  "key" VARCHAR(160) NOT NULL,
  "subject" VARCHAR(60),
  "scope" VARCHAR(80) NOT NULL,
  "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "csca_ai_questioning_settings_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "idx_csca_ai_questioning_settings_subject_scope"
  ON "csca_ai_questioning_settings" ("subject", "scope");

ALTER TABLE "csca_ai_questioning_settings"
  ADD CONSTRAINT "csca_ai_questioning_settings_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
