CREATE TABLE IF NOT EXISTS "past_papers" (
  "id" SERIAL PRIMARY KEY,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "subject" VARCHAR(60) NOT NULL,
  "exam_year" INTEGER,
  "exam_month" VARCHAR(40),
  "session_label" VARCHAR(120),
  "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
  "description" TEXT,
  "question_count" INTEGER,
  "page_count" INTEGER,
  "has_answers" BOOLEAN NOT NULL DEFAULT false,
  "has_solutions" BOOLEAN NOT NULL DEFAULT false,
  "cover_url" TEXT,
  "is_free" BOOLEAN NOT NULL DEFAULT true,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "past_papers_slug_key"
  ON "past_papers"("slug");

CREATE INDEX IF NOT EXISTS "idx_past_papers_subject_published_sort"
  ON "past_papers"("subject", "is_published", "sort_order");

CREATE INDEX IF NOT EXISTS "idx_past_papers_featured_sort"
  ON "past_papers"("is_published", "is_featured", "sort_order");

CREATE TABLE IF NOT EXISTS "past_paper_files" (
  "id" SERIAL PRIMARY KEY,
  "past_paper_id" INTEGER NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "file_url" TEXT NOT NULL,
  "original_filename" VARCHAR(240),
  "mime_type" VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
  "file_size_bytes" INTEGER,
  "checksum" VARCHAR(128),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "past_paper_files_past_paper_id_fkey"
    FOREIGN KEY ("past_paper_id") REFERENCES "past_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_past_paper_files_paper_kind"
  ON "past_paper_files"("past_paper_id", "kind");

CREATE TABLE IF NOT EXISTS "past_paper_downloads" (
  "id" SERIAL PRIMARY KEY,
  "past_paper_id" INTEGER NOT NULL,
  "file_id" INTEGER,
  "user_id" INTEGER,
  "ip_hash" VARCHAR(128),
  "user_agent_hash" VARCHAR(128),
  "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "past_paper_downloads_past_paper_id_fkey"
    FOREIGN KEY ("past_paper_id") REFERENCES "past_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "past_paper_downloads_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "past_paper_files"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "past_paper_downloads_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_past_paper_downloads_paper_time"
  ON "past_paper_downloads"("past_paper_id", "downloaded_at");

CREATE INDEX IF NOT EXISTS "idx_past_paper_downloads_user_time"
  ON "past_paper_downloads"("user_id", "downloaded_at");
