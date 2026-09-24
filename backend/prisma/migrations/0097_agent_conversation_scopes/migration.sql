ALTER TABLE "agent_conversations"
  ADD COLUMN "scope_type" VARCHAR(40) NOT NULL DEFAULT 'learning_context',
  ADD COLUMN "scope_round_id" INTEGER,
  ADD COLUMN "scope_question_id" INTEGER;

-- Historical user-created conversations were the independent subject-Q&A
-- surface unless their first user message binds them to a concrete question.
UPDATE "agent_conversations"
SET "scope_type" = 'independent_subject_qa'
WHERE "title" IS DISTINCT FROM '__learning_workspace__';

WITH "first_user_message" AS (
  SELECT DISTINCT ON ("conversation_id")
    "conversation_id",
    "content"
  FROM "agent_messages"
  WHERE "role" = 'user'
  ORDER BY "conversation_id", "created_at" ASC, "id" ASC
), "question_binding" AS (
  SELECT
    "conversation_id",
    "content"->'pageContext'->'questionContext'->>'roundId' AS "round_id",
    "content"->'pageContext'->'questionContext'->>'questionId' AS "question_id"
  FROM "first_user_message"
  WHERE "content"->>'surface' = 'subject_qa'
)
UPDATE "agent_conversations" AS "conversation"
SET
  "scope_type" = 'practice_question_qa',
  "scope_round_id" = "binding"."round_id"::INTEGER,
  "scope_question_id" = "binding"."question_id"::INTEGER
FROM "question_binding" AS "binding"
WHERE "conversation"."id" = "binding"."conversation_id"
  AND "binding"."round_id" ~ '^[1-9][0-9]*$'
  AND "binding"."question_id" ~ '^[1-9][0-9]*$';

ALTER TABLE "agent_conversations"
  ADD CONSTRAINT "ck_agent_conversations_scope_binding"
  CHECK (
    ("scope_type" = 'practice_question_qa' AND "scope_round_id" IS NOT NULL AND "scope_question_id" IS NOT NULL)
    OR
    ("scope_type" IN ('learning_context', 'independent_subject_qa') AND "scope_round_id" IS NULL AND "scope_question_id" IS NULL)
  );

CREATE INDEX "idx_agent_conversations_scope"
  ON "agent_conversations"("user_id", "scope_type", "scope_round_id", "scope_question_id");
