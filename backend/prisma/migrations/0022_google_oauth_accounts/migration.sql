ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE TABLE "oauth_accounts" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "provider_user_id" VARCHAR(191) NOT NULL,
  "email" VARCHAR(255),
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "display_name" VARCHAR(100),
  "picture_url" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_oauth_provider_subject" ON "oauth_accounts"("provider", "provider_user_id");
CREATE INDEX "idx_oauth_accounts_user" ON "oauth_accounts"("user_id");
CREATE INDEX "idx_oauth_accounts_email" ON "oauth_accounts"("email");

ALTER TABLE "oauth_accounts"
  ADD CONSTRAINT "oauth_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
