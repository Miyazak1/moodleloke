CREATE TABLE "csca_ai_entitlement_accounts" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "balance_units" INTEGER NOT NULL DEFAULT 0,
  "lifetime_granted" INTEGER NOT NULL DEFAULT 0,
  "lifetime_used" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_ai_entitlement_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "csca_ai_usage_ledger" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "account_id" INTEGER,
  "interaction_id" INTEGER,
  "ability_type" VARCHAR(60) NOT NULL,
  "provider" VARCHAR(60),
  "model" VARCHAR(120),
  "units_delta" INTEGER NOT NULL,
  "reason" VARCHAR(80) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'posted',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_ai_usage_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "csca_ai_entitlement_accounts_user_id_key" ON "csca_ai_entitlement_accounts"("user_id");
CREATE INDEX "idx_csca_ai_entitlement_accounts_user" ON "csca_ai_entitlement_accounts"("user_id");
CREATE INDEX "idx_csca_ai_usage_ledger_user_created" ON "csca_ai_usage_ledger"("user_id", "created_at");
CREATE INDEX "idx_csca_ai_usage_ledger_interaction" ON "csca_ai_usage_ledger"("interaction_id");
CREATE INDEX "idx_csca_ai_usage_ledger_status_created" ON "csca_ai_usage_ledger"("status", "created_at");

ALTER TABLE "csca_ai_entitlement_accounts"
  ADD CONSTRAINT "csca_ai_entitlement_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "csca_ai_usage_ledger"
  ADD CONSTRAINT "csca_ai_usage_ledger_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "csca_ai_usage_ledger"
  ADD CONSTRAINT "csca_ai_usage_ledger_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "csca_ai_entitlement_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "csca_ai_usage_ledger"
  ADD CONSTRAINT "csca_ai_usage_ledger_interaction_id_fkey"
  FOREIGN KEY ("interaction_id") REFERENCES "csca_ai_interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
