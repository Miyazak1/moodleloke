CREATE TABLE "mock_exam_papers" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(60) NOT NULL,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
  "question_count" INTEGER NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "price_label" VARCHAR(80),
  "is_free" BOOLEAN NOT NULL DEFAULT false,
  "is_locked" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_mock_exam_papers_subject_status_sort" ON "mock_exam_papers"("subject", "status", "sort_order");
CREATE INDEX "idx_mock_exam_papers_status_sort" ON "mock_exam_papers"("status", "sort_order");

CREATE TABLE "mock_exam_questions" (
  "id" SERIAL PRIMARY KEY,
  "paper_id" INTEGER NOT NULL,
  "order_number" INTEGER NOT NULL,
  "question_type" VARCHAR(100) NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_answer" VARCHAR(50) NOT NULL,
  "explanation" TEXT NOT NULL,
  "knowledge_tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_exam_questions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "mock_exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_mock_exam_questions_paper_order" ON "mock_exam_questions"("paper_id", "order_number");
CREATE INDEX "idx_mock_exam_questions_paper_status_order" ON "mock_exam_questions"("paper_id", "status", "order_number");

CREATE TABLE "mock_exam_attempts" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "paper_id" INTEGER NOT NULL,
  "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "marked_questions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "time_spent" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "current_question" INTEGER NOT NULL DEFAULT 1,
  "score" INTEGER,
  "correct_count" INTEGER,
  "wrong_count" INTEGER,
  "unanswered_count" INTEGER,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "mock_exam_attempts_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "mock_exam_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_mock_exam_attempts_user_created" ON "mock_exam_attempts"("user_id", "created_at");
CREATE INDEX "idx_mock_exam_attempts_paper_submitted" ON "mock_exam_attempts"("paper_id", "submitted_at");
