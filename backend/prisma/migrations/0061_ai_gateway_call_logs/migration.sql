CREATE TABLE "ai_gateway_call_logs" (
  "id" SERIAL NOT NULL,
  "request_id" TEXT NOT NULL,
  "task_type" VARCHAR(80) NOT NULL,
  "source_module" VARCHAR(120) NOT NULL,
  "provider_id" VARCHAR(80) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "key_id" VARCHAR(160) NOT NULL,
  "user_id" INTEGER,
  "organization_id" INTEGER,
  "status" VARCHAR(40) NOT NULL,
  "error_code" VARCHAR(80),
  "error_message" TEXT,
  "latency_ms" INTEGER NOT NULL,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "estimated_cost" DECIMAL(65,30),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_gateway_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_gateway_call_logs_request_id_key" ON "ai_gateway_call_logs"("request_id");
CREATE INDEX "idx_ai_gateway_call_logs_task_created" ON "ai_gateway_call_logs"("task_type", "created_at");
CREATE INDEX "idx_ai_gateway_call_logs_provider_created" ON "ai_gateway_call_logs"("provider_id", "created_at");
CREATE INDEX "idx_ai_gateway_call_logs_key_created" ON "ai_gateway_call_logs"("key_id", "created_at");
CREATE INDEX "idx_ai_gateway_call_logs_user_created" ON "ai_gateway_call_logs"("user_id", "created_at");
CREATE INDEX "idx_ai_gateway_call_logs_org_created" ON "ai_gateway_call_logs"("organization_id", "created_at");
