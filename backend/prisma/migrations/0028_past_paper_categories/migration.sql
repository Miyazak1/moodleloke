ALTER TABLE "past_papers" ADD COLUMN "category" VARCHAR(40) NOT NULL DEFAULT 'past-paper';

DROP INDEX IF EXISTS "idx_past_papers_subject_published_sort";

CREATE INDEX "idx_past_papers_category_subject_published_sort"
  ON "past_papers"("category", "subject", "is_published", "sort_order");
