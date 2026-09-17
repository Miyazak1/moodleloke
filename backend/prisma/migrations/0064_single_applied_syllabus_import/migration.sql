WITH ranked_applied_imports AS (
  SELECT
    "id",
    "subject",
    ROW_NUMBER() OVER (
      PARTITION BY "subject"
      ORDER BY "applied_at" DESC NULLS LAST, "updated_at" DESC, "id" DESC
    ) AS "rank"
  FROM "csca_syllabus_imports"
  WHERE "status" = 'applied'
)
UPDATE "csca_syllabus_imports" syllabus_import
SET "status" = 'archived',
    "preview_summary" = COALESCE(syllabus_import."preview_summary", '{}'::jsonb) || jsonb_build_object(
      'supersededBy',
      jsonb_build_object(
        'reason', 'single_applied_syllabus_import_migration',
        'archivedAt', to_jsonb(CURRENT_TIMESTAMP)
      )
    ),
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_applied_imports ranked
WHERE syllabus_import."id" = ranked."id"
  AND ranked."rank" > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_syllabus_imports_one_applied_per_subject"
  ON "csca_syllabus_imports" ("subject")
  WHERE "status" = 'applied';
