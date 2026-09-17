CREATE TABLE "organization_invite_attempts" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "invite_id" INTEGER,
  "lookup_mode" VARCHAR(40) NOT NULL,
  "invite_hash" VARCHAR(120),
  "status" VARCHAR(40) NOT NULL,
  "reason" VARCHAR(160),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invite_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "organization_invite_attempts_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "organization_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_organization_invite_attempts_user_mode" ON "organization_invite_attempts"("user_id", "lookup_mode", "status", "created_at");
CREATE INDEX "idx_organization_invite_attempts_hash" ON "organization_invite_attempts"("invite_hash", "created_at");
