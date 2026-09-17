CREATE TABLE "agent_attachments" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'created',
  "kind" VARCHAR(24) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "declared_mime" VARCHAR(120),
  "detected_mime" VARCHAR(120),
  "size_bytes" INTEGER,
  "storage_key" VARCHAR(500),
  "sha256" VARCHAR(64),
  "page_count" INTEGER,
  "error_code" VARCHAR(80),
  "error_message" VARCHAR(500),
  "metadata" JSONB,
  "retained_until" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_attachment_pages" (
  "id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "page_number" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "extracted_text" TEXT,
  "extraction_method" VARCHAR(32) NOT NULL DEFAULT 'none',
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_attachment_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_attachment_chunks" (
  "id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "page_id" TEXT,
  "ordinal" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "char_count" INTEGER NOT NULL,
  "extraction_method" VARCHAR(32) NOT NULL,
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_attachment_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_message_attachments" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_agent_attachments_user_status_created" ON "agent_attachments"("user_id", "status", "created_at");
CREATE INDEX "idx_agent_attachments_conversation_created" ON "agent_attachments"("conversation_id", "created_at");
CREATE INDEX "idx_agent_attachments_status_retention" ON "agent_attachments"("status", "retained_until");
CREATE UNIQUE INDEX "uq_agent_attachment_pages_number" ON "agent_attachment_pages"("attachment_id", "page_number");
CREATE INDEX "idx_agent_attachment_pages_created" ON "agent_attachment_pages"("attachment_id", "created_at");
CREATE UNIQUE INDEX "uq_agent_attachment_chunks_ordinal" ON "agent_attachment_chunks"("attachment_id", "ordinal");
CREATE INDEX "idx_agent_attachment_chunks_page" ON "agent_attachment_chunks"("page_id", "ordinal");
CREATE UNIQUE INDEX "uq_agent_message_attachments" ON "agent_message_attachments"("message_id", "attachment_id");
CREATE INDEX "idx_agent_message_attachments_attachment" ON "agent_message_attachments"("attachment_id", "created_at");

ALTER TABLE "agent_attachments" ADD CONSTRAINT "agent_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachments" ADD CONSTRAINT "agent_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_pages" ADD CONSTRAINT "agent_attachment_pages_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_chunks" ADD CONSTRAINT "agent_attachment_chunks_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_attachment_chunks" ADD CONSTRAINT "agent_attachment_chunks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "agent_attachment_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_message_attachments" ADD CONSTRAINT "agent_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "agent_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_message_attachments" ADD CONSTRAINT "agent_message_attachments_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "agent_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
