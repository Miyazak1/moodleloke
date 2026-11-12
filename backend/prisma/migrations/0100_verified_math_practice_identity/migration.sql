-- Generated questions receive ordinary-practice qualification only. Identity is
-- unique within the host knowledge point and frozen exact generation scope.
CREATE UNIQUE INDEX "uq_verified_math_practice_identity"
ON "csca_questions" (
  "topic_id",
  ("generation_metadata"->>'scopeId'),
  ("generation_metadata"->>'mathIdentityHash')
)
WHERE "source_type" = 'verified_math_engine';
