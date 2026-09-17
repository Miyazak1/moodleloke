CREATE TABLE "csca_training_events" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "subject" VARCHAR(60),
  "session_id" INTEGER,
  "round_id" INTEGER,
  "question_id" INTEGER,
  "event_type" VARCHAR(80) NOT NULL,
  "source" VARCHAR(40) NOT NULL DEFAULT 'adaptive',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "csca_training_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_csca_training_events_user_created" ON "csca_training_events"("user_id", "created_at");
CREATE INDEX "idx_csca_training_events_type_created" ON "csca_training_events"("event_type", "created_at");
CREATE INDEX "idx_csca_training_events_session_created" ON "csca_training_events"("session_id", "created_at");
CREATE INDEX "idx_csca_training_events_round_created" ON "csca_training_events"("round_id", "created_at");

ALTER TABLE "csca_training_events"
  ADD CONSTRAINT "csca_training_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
