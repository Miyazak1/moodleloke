ALTER TABLE "agent_conversations"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "purge_after" TIMESTAMP(3);

-- Practice-question chats are temporary assistance context. Existing rows get a
-- deterministic 90-day retention deadline based on their most recent activity.
UPDATE "agent_conversations"
SET "purge_after" = COALESCE("last_message_at", "created_at") + INTERVAL '90 days'
WHERE "scope_type" = 'practice_question_qa';

CREATE INDEX "idx_agent_conversations_lifecycle"
  ON "agent_conversations"("scope_type", "status", "purge_after");
