CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

ALTER TABLE "users"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active';

CREATE TABLE "admin_audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "actor_id" INTEGER,
  "module" VARCHAR(80) NOT NULL,
  "resource_type" VARCHAR(80) NOT NULL,
  "resource_id" VARCHAR(120),
  "action" VARCHAR(120) NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_admin_audit_logs_module_created" ON "admin_audit_logs"("module", "created_at");
CREATE INDEX "idx_admin_audit_logs_actor_created" ON "admin_audit_logs"("actor_id", "created_at");
