CREATE INDEX IF NOT EXISTS "idx_csca_questions_ai_generation_production_run_cell"
  ON "csca_questions" (
    ("generation_metadata"->>'productionRunId'),
    ("generation_metadata"->>'productionCellId')
  )
  WHERE "source_type" = 'ai';

CREATE INDEX IF NOT EXISTS "idx_csca_ai_generation_jobs_prompt_production_run_cell"
  ON "csca_ai_generation_jobs" (
    ("prompt_metadata"->>'productionRunId'),
    ("prompt_metadata"->>'productionCellId'),
    "status"
  );
