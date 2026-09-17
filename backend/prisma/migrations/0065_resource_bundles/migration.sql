CREATE TABLE "resource_bundles" (
  "id" SERIAL NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "category" VARCHAR(40) NOT NULL DEFAULT 'past-paper',
  "subject_scope" VARCHAR(60) NOT NULL DEFAULT 'mixed',
  "language" VARCHAR(20) NOT NULL DEFAULT 'zh',
  "description" TEXT,
  "cover_url" TEXT,
  "highlights" JSONB NOT NULL DEFAULT '[]',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "resource_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_bundle_items" (
  "id" SERIAL NOT NULL,
  "bundle_id" INTEGER NOT NULL,
  "past_paper_id" INTEGER NOT NULL,
  "label" VARCHAR(160),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "resource_bundle_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_bundles_slug_key" ON "resource_bundles"("slug");
CREATE INDEX "idx_resource_bundles_category_subject_published_sort" ON "resource_bundles"("category", "subject_scope", "is_published", "sort_order");
CREATE INDEX "idx_resource_bundles_featured_sort" ON "resource_bundles"("is_published", "is_featured", "sort_order");
CREATE UNIQUE INDEX "uq_resource_bundle_items_bundle_paper" ON "resource_bundle_items"("bundle_id", "past_paper_id");
CREATE INDEX "idx_resource_bundle_items_bundle_sort" ON "resource_bundle_items"("bundle_id", "sort_order");
CREATE INDEX "idx_resource_bundle_items_paper" ON "resource_bundle_items"("past_paper_id");

ALTER TABLE "resource_bundle_items"
  ADD CONSTRAINT "resource_bundle_items_bundle_id_fkey"
  FOREIGN KEY ("bundle_id") REFERENCES "resource_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_bundle_items"
  ADD CONSTRAINT "resource_bundle_items_past_paper_id_fkey"
  FOREIGN KEY ("past_paper_id") REFERENCES "past_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "resource_bundles" (
  "slug",
  "title",
  "category",
  "subject_scope",
  "language",
  "description",
  "cover_url",
  "highlights",
  "tags",
  "is_featured",
  "is_published",
  "sort_order",
  "version",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  CONCAT('single-', "slug"),
  "title",
  "category",
  "subject",
  "language",
  "description",
  "cover_url",
  jsonb_build_array(
    CASE WHEN "category" = 'mock-paper' THEN '单套模拟卷' ELSE '单份真题资料' END,
    CASE WHEN "has_solutions" THEN '含解析' WHEN "has_answers" THEN '含答案' ELSE '原卷资料' END,
    '免费下载'
  ),
  jsonb_build_array("subject", COALESCE(CAST("exam_year" AS TEXT), 'CSCA')),
  "is_featured",
  "is_published",
  "sort_order",
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CASE WHEN "deleted_at" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
FROM "past_papers"
WHERE NOT EXISTS (
  SELECT 1
  FROM "resource_bundles" rb
  WHERE rb."slug" = CONCAT('single-', "past_papers"."slug")
);

INSERT INTO "resource_bundle_items" (
  "bundle_id",
  "past_paper_id",
  "label",
  "sort_order",
  "created_at"
)
SELECT
  rb."id",
  pp."id",
  pp."title",
  0,
  CURRENT_TIMESTAMP
FROM "past_papers" pp
JOIN "resource_bundles" rb ON rb."slug" = CONCAT('single-', pp."slug")
WHERE NOT EXISTS (
  SELECT 1
  FROM "resource_bundle_items" rbi
  WHERE rbi."bundle_id" = rb."id"
    AND rbi."past_paper_id" = pp."id"
);
