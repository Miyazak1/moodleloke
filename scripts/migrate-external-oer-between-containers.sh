#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/migrate-external-oer-between-containers.sh SOURCE_CONTAINER TARGET_CONTAINER
  CONFIRM_TARGET_CONTAINER=TARGET_CONTAINER bash scripts/migrate-external-oer-between-containers.sh SOURCE_CONTAINER TARGET_CONTAINER --apply

The default mode is read-only. Apply mode backs up the target database, then imports only
approved external_oer questions whose exam topics are published. AI, draft, demo, and candidate
questions are never exported.
EOF
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
  exit 1
fi

source_container="$1"
target_container="$2"
mode="${3:-}"
apply=false
if [[ -n "$mode" ]]; then
  if [[ "$mode" != "--apply" ]]; then
    usage
    exit 1
  fi
  apply=true
fi

container_pattern='^[A-Za-z0-9][A-Za-z0-9_.-]*$'
if [[ ! "$source_container" =~ $container_pattern || ! "$target_container" =~ $container_pattern ]]; then
  echo 'Container names may only contain letters, digits, dots, underscores, and hyphens.' >&2
  exit 1
fi
if [[ "$source_container" == "$target_container" ]]; then
  echo 'Source and target containers must be different.' >&2
  exit 1
fi

for container in "$source_container" "$target_container"; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != 'true' ]]; then
    echo "Container is not running: $container" >&2
    exit 1
  fi
done

read_source_count() {
  docker exec -i "$source_container" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
SELECT COUNT(*)
FROM csca_questions q
JOIN csca_exam_topics t ON t.id = q.topic_id
WHERE q.status = 'approved'
  AND q.source_type = 'external_oer'
  AND t.status = 'published';
SQL
}

read_target_count() {
  docker exec -i "$target_container" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
SELECT COUNT(*)
FROM csca_questions q
JOIN csca_exam_topics t ON t.id = q.topic_id
WHERE q.status = 'approved'
  AND q.source_type = 'external_oer'
  AND t.status = 'published';
SQL
}

source_count="$(read_source_count | tr -d '[:space:]')"
target_before_count="$(read_target_count | tr -d '[:space:]')"
if [[ ! "$source_count" =~ ^[0-9]+$ || ! "$target_before_count" =~ ^[0-9]+$ ]]; then
  echo 'Could not read a valid source or target count.' >&2
  exit 1
fi

printf 'Mode: %s\nSource container: %s\nTarget container: %s\n' "$([[ "$apply" == true ]] && echo apply || echo plan)" "$source_container" "$target_container"
printf 'Eligible source external_oer questions: %s\nCurrent target external_oer questions: %s\n' "$source_count" "$target_before_count"

if [[ "$source_count" -eq 0 ]]; then
  echo 'No eligible public questions were found; nothing to migrate.' >&2
  exit 1
fi
if [[ "$apply" != true ]]; then
  echo 'Plan only; no database command modified either database.'
  exit 0
fi
if [[ "${CONFIRM_TARGET_CONTAINER:-}" != "$target_container" ]]; then
  echo "Set CONFIRM_TARGET_CONTAINER exactly to '$target_container' before apply mode." >&2
  exit 1
fi

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir=".local/external-oer-migrations/$run_id"
mkdir -p "$run_dir"
target_backup="$run_dir/target-before.dump"
topics_csv="$run_dir/topics.csv"
questions_csv="$run_dir/questions.csv"
manifest="$run_dir/manifest.txt"
remote_topics='/tmp/moodlelike-external-oer-topics.csv'
remote_questions='/tmp/moodlelike-external-oer-questions.csv'

cleanup() {
  docker exec "$target_container" rm -f "$remote_topics" "$remote_questions" >/dev/null 2>&1 || true
}
trap cleanup EXIT

printf 'Creating target backup: %s\n' "$target_backup"
docker exec "$target_container" sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$target_backup"

docker exec -i "$source_container" sh -lc 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$topics_csv" <<'SQL'
COPY (
  SELECT DISTINCT
    t.subject,
    t.module,
    t.code,
    t.title,
    t.description,
    t.exam_scope,
    t.syllabus_version,
    t.source_url,
    t.source_label,
    t.last_verified_at,
    t.weight,
    t.allowed_question_types,
    t.difficulty_range,
    t.excluded_scope,
    t.status,
    t.created_at,
    t.updated_at
  FROM csca_exam_topics t
  JOIN csca_questions q ON q.topic_id = t.id
  WHERE q.status = 'approved'
    AND q.source_type = 'external_oer'
    AND t.status = 'published'
  ORDER BY t.subject, t.code
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);
SQL

docker exec -i "$source_container" sh -lc 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$questions_csv" <<'SQL'
COPY (
  SELECT
    q.id AS legacy_question_id,
    t.code AS topic_code,
    q.subject,
    q.source_type,
    q.designed_difficulty,
    q.empirical_difficulty,
    q.difficulty_confidence,
    q.question_type,
    q.prompt,
    q.options,
    q.correct_answer,
    q.explanation,
    q.knowledge_tags,
    q.option_metadata,
    q.syllabus_version,
    q.generation_metadata,
    q.review_metadata,
    q.version,
    q.created_at,
    q.updated_at
  FROM csca_questions q
  JOIN csca_exam_topics t ON t.id = q.topic_id
  WHERE q.status = 'approved'
    AND q.source_type = 'external_oer'
    AND t.status = 'published'
  ORDER BY q.subject, q.id
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);
SQL

docker cp "$topics_csv" "$target_container:$remote_topics" >/dev/null
docker cp "$questions_csv" "$target_container:$remote_questions" >/dev/null

docker exec -i "$target_container" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
BEGIN;

CREATE TEMP TABLE external_oer_topic_stage (
  subject text,
  module text,
  code text,
  title text,
  description text,
  exam_scope text,
  syllabus_version text,
  source_url text,
  source_label text,
  last_verified_at timestamptz,
  weight integer,
  allowed_question_types jsonb,
  difficulty_range jsonb,
  excluded_scope jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
);
\copy external_oer_topic_stage FROM '/tmp/moodlelike-external-oer-topics.csv' WITH (FORMAT CSV, HEADER TRUE)

INSERT INTO csca_exam_topics (
  subject, module, code, title, description, exam_scope, syllabus_version,
  source_url, source_label, last_verified_at, weight, allowed_question_types,
  difficulty_range, excluded_scope, status, created_at, updated_at
)
SELECT
  subject, module, code, title, description, exam_scope, syllabus_version,
  source_url, source_label, last_verified_at, weight, allowed_question_types,
  difficulty_range, excluded_scope, status, created_at, updated_at
FROM external_oer_topic_stage
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM external_oer_topic_stage stage
    LEFT JOIN csca_exam_topics topic ON topic.code = stage.code
    WHERE topic.id IS NULL OR topic.status <> 'published' OR topic.subject <> stage.subject
  ) THEN
    RAISE EXCEPTION 'One or more imported topic codes are missing, unpublished, or belong to another subject.';
  END IF;
END $$;

CREATE TEMP TABLE external_oer_question_stage (
  legacy_question_id bigint,
  topic_code text,
  subject text,
  source_type text,
  designed_difficulty text,
  empirical_difficulty text,
  difficulty_confidence double precision,
  question_type text,
  prompt text,
  options jsonb,
  correct_answer text,
  explanation text,
  knowledge_tags jsonb,
  option_metadata jsonb,
  syllabus_version text,
  generation_metadata jsonb,
  review_metadata jsonb,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
);
\copy external_oer_question_stage FROM '/tmp/moodlelike-external-oer-questions.csv' WITH (FORMAT CSV, HEADER TRUE)

INSERT INTO csca_questions (
  subject, topic_id, blueprint_id, source_type, source_question_id,
  generated_variant_of, designed_difficulty, empirical_difficulty,
  difficulty_confidence, question_type, prompt, options, correct_answer,
  explanation, knowledge_tags, option_metadata, syllabus_version,
  generation_metadata, review_metadata, status, version, created_at, updated_at
)
SELECT
  stage.subject,
  topic.id,
  NULL,
  'external_oer',
  NULL,
  NULL,
  stage.designed_difficulty,
  stage.empirical_difficulty,
  stage.difficulty_confidence,
  stage.question_type,
  stage.prompt,
  stage.options,
  stage.correct_answer,
  stage.explanation,
  COALESCE(stage.knowledge_tags, '[]'::jsonb),
  stage.option_metadata,
  stage.syllabus_version,
  COALESCE(stage.generation_metadata, '{}'::jsonb) || jsonb_build_object(
    'externalOerImport', jsonb_build_object(
      'legacyQuestionId', stage.legacy_question_id,
      'sourceSystem', 'cscalite',
      'importedAt', NOW()
    )
  ),
  stage.review_metadata,
  'approved',
  GREATEST(stage.version, 1),
  stage.created_at,
  stage.updated_at
FROM external_oer_question_stage stage
JOIN csca_exam_topics topic ON topic.code = stage.topic_code
WHERE topic.status = 'published'
  AND topic.subject = stage.subject
  AND NOT EXISTS (
    SELECT 1
    FROM csca_questions existing
    WHERE existing.source_type = 'external_oer'
      AND (
        existing.generation_metadata->'externalOerImport'->>'legacyQuestionId' = stage.legacy_question_id::text
        OR (
          existing.subject = stage.subject
          AND existing.topic_id = topic.id
          AND existing.prompt = stage.prompt
          AND existing.correct_answer = stage.correct_answer
        )
      )
  );

COMMIT;
SQL

target_after_count="$(read_target_count | tr -d '[:space:]')"
if [[ ! "$target_after_count" =~ ^[0-9]+$ || "$target_after_count" -lt "$source_count" ]]; then
  echo "Target verification failed: source=$source_count target_after=$target_after_count" >&2
  echo "Backup is available at: $target_backup" >&2
  exit 1
fi

cat > "$manifest" <<EOF
schema_version=1
run_id=$run_id
source_container=$source_container
target_container=$target_container
source_eligible_count=$source_count
target_before_count=$target_before_count
target_after_count=$target_after_count
target_backup=$target_backup
scope=approved_external_oer_with_published_topics_only
EOF

printf 'Migration completed. Target external_oer count: %s\n' "$target_after_count"
printf 'Backup: %s\nManifest: %s\n' "$target_backup" "$manifest"
