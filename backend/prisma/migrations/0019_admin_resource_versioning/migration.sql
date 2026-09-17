ALTER TABLE "mock_exam_papers" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "mock_exam_questions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "special_practice_topics" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "special_practice_questions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
