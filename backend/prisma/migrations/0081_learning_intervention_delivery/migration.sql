CREATE TABLE "learning_intervention_deliveries" (
  "id" TEXT NOT NULL,
  "intervention_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "channel" VARCHAR(32) NOT NULL DEFAULT 'agent_web',
  "placement" VARCHAR(32) NOT NULL DEFAULT 'after_round',
  "status" VARCHAR(32) NOT NULL DEFAULT 'offered',
  "content_source_type" VARCHAR(40),
  "content_source_id" VARCHAR(120),
  "content_source_version" VARCHAR(80),
  "content_snapshot" JSONB,
  "context_snapshot" JSONB NOT NULL DEFAULT '{}',
  "offered_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "deferred_until" TIMESTAMP(3),
  "skipped_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_intervention_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_intervention_steps" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "client_request_id" VARCHAR(120) NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "from_status" VARCHAR(32),
  "to_status" VARCHAR(32) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_intervention_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_learning_intervention_delivery_channel" ON "learning_intervention_deliveries"("intervention_id", "channel");
CREATE INDEX "idx_learning_intervention_deliveries_user_status" ON "learning_intervention_deliveries"("user_id", "status", "updated_at");
CREATE INDEX "idx_learning_intervention_delivery_content" ON "learning_intervention_deliveries"("content_source_type", "content_source_id");
CREATE UNIQUE INDEX "uq_learning_intervention_step_request" ON "learning_intervention_steps"("user_id", "client_request_id");
CREATE INDEX "idx_learning_intervention_steps_delivery" ON "learning_intervention_steps"("delivery_id", "created_at");

ALTER TABLE "learning_intervention_deliveries" ADD CONSTRAINT "learning_intervention_deliveries_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "learning_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_deliveries" ADD CONSTRAINT "learning_intervention_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_steps" ADD CONSTRAINT "learning_intervention_steps_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "learning_intervention_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_intervention_steps" ADD CONSTRAINT "learning_intervention_steps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
