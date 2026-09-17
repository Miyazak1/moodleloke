ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "email_verification_sent_at" TIMESTAMP(3);

CREATE TABLE "auth_email_tokens" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_email_tokens_token_hash_key" ON "auth_email_tokens"("token_hash");
CREATE INDEX "idx_auth_email_tokens_user_type" ON "auth_email_tokens"("user_id", "type", "used_at");
CREATE INDEX "idx_auth_email_tokens_expires" ON "auth_email_tokens"("expires_at");

ALTER TABLE "auth_email_tokens"
  ADD CONSTRAINT "auth_email_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
