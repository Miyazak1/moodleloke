CREATE TABLE "special_practice_topics" (
  "id" SERIAL NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "module" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "estimated_minutes" INTEGER NOT NULL DEFAULT 20,
  "question_count" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_practice_topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "special_practice_topics_slug_key" ON "special_practice_topics"("slug");
CREATE INDEX "idx_special_practice_topics_subject_status_sort" ON "special_practice_topics"("subject", "status", "sort_order");
CREATE INDEX "idx_special_practice_topics_module_status" ON "special_practice_topics"("module", "status");

CREATE TABLE "special_practice_questions" (
  "id" SERIAL NOT NULL,
  "topic_id" INTEGER NOT NULL,
  "order_number" INTEGER NOT NULL,
  "difficulty" VARCHAR(30) NOT NULL DEFAULT '基础',
  "question_type" VARCHAR(100) NOT NULL DEFAULT 'single-choice',
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_answer" VARCHAR(50) NOT NULL,
  "explanation" TEXT NOT NULL,
  "knowledge_tags" JSONB NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_practice_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_practice_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "special_practice_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_special_practice_questions_topic_order" ON "special_practice_questions"("topic_id", "order_number");
CREATE INDEX "idx_special_practice_questions_topic_status_order" ON "special_practice_questions"("topic_id", "status", "order_number");

CREATE TABLE "special_practice_sessions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "topic_id" INTEGER NOT NULL,
  "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "time_spent" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "current_question" INTEGER NOT NULL DEFAULT 1,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "wrong_count" INTEGER NOT NULL DEFAULT 0,
  "unanswered_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_practice_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "special_practice_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "special_practice_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_special_practice_sessions_user_created" ON "special_practice_sessions"("user_id", "created_at");
CREATE INDEX "idx_special_practice_sessions_topic_created" ON "special_practice_sessions"("topic_id", "created_at");
