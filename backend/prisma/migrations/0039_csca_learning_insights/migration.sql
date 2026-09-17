CREATE TABLE "csca_learning_insights" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period_type" VARCHAR(40) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "recommended_actions" JSONB NOT NULL DEFAULT '[]',
    "provider" VARCHAR(60),
    "model" VARCHAR(120),
    "status" VARCHAR(40) NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csca_learning_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_csca_learning_insights_user_period" ON "csca_learning_insights"("user_id", "period_type", "period_start");

ALTER TABLE "csca_learning_insights" ADD CONSTRAINT "csca_learning_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
