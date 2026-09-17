CREATE TABLE "practice_questions" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(100) NOT NULL,
  "question_type" VARCHAR(100) NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_answer" VARCHAR(50) NOT NULL,
  "explanation" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'published',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_practice_questions_status_sort" ON "practice_questions"("status", "sort_order");

CREATE TABLE "practice_attempts" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER,
  "answers" JSONB NOT NULL,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practice_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_practice_attempts_user_created" ON "practice_attempts"("user_id", "created_at");

INSERT INTO "practice_questions" ("subject", "question_type", "prompt", "options", "correct_answer", "explanation", "sort_order")
VALUES
  (
    'CSCA 判断',
    'school-requirement',
    '如果一所学校把 CSCA 写在本科国际生申请材料清单里，准备时第一步更应该做什么？',
    '[{"id":"A","text":"先随机刷题，之后再看学校要求"},{"id":"B","text":"先确认目标专业、授课语言和 CSCA 科目要求"},{"id":"C","text":"只看学校综合排名"},{"id":"D","text":"直接进入顾问服务，不需要看公开材料"}]'::jsonb,
    'B',
    'CSCA 准备应先从学校和专业要求倒推，确认科目、语言和提交时间，再安排练习。',
    1
  ),
  (
    'CSCA 科目',
    'subject-planning',
    '同一所大学的中文授课与英文授课项目可能对应不同 CSCA 要求，这意味着什么？',
    '[{"id":"A","text":"所有专业都考同一套科目"},{"id":"B","text":"只要英语好就不需要看 CSCA"},{"id":"C","text":"需要按项目页面或附件逐项核对科目"},{"id":"D","text":"只看申请费就能决定准备方向"}]'::jsonb,
    'C',
    '不同授课语言和专业方向可能对应不同试卷语种与科目组合，应逐项核对学校来源。',
    2
  ),
  (
    '准备节奏',
    'prep-sequence',
    '在还没有确认目标学校 CSCA 科目前，最稳妥的准备策略是什么？',
    '[{"id":"A","text":"先建立学校清单和要求判断，再进入样题练习"},{"id":"B","text":"直接报名所有可能科目"},{"id":"C","text":"完全不看语言要求"},{"id":"D","text":"只准备一个自己最熟悉的科目"}]'::jsonb,
    'A',
    '目标不清时先看学校案例和要求链路，等方向明确后再用样题检查知识点和时间安排。',
    3
  );
