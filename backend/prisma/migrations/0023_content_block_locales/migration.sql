ALTER TABLE "content_blocks"
  ADD COLUMN IF NOT EXISTS "locale" VARCHAR(20) NOT NULL DEFAULT 'zh-CN';

ALTER TABLE "content_blocks"
  DROP CONSTRAINT IF EXISTS "content_blocks_key_key";

DROP INDEX IF EXISTS "content_blocks_key_key";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_content_blocks_key_locale"
  ON "content_blocks"("key", "locale");

CREATE INDEX IF NOT EXISTS "idx_content_blocks_locale_status_sort"
  ON "content_blocks"("locale", "status", "sort_order");
