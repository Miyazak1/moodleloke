ALTER TABLE "organization_invites"
  ADD COLUMN "short_code_hash" VARCHAR(120);

CREATE UNIQUE INDEX "organization_invites_short_code_hash_key" ON "organization_invites"("short_code_hash");
