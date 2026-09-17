CREATE UNIQUE INDEX IF NOT EXISTS "uq_csca_ai_questioning_tasks_observation_batch_ordinal"
  ON "csca_ai_questioning_tasks" (
    (("filter_snapshot"->'sealedObservationBatch'->>'batchId')),
    ((("filter_snapshot"->'sealedObservationBatch'->>'taskOrdinal')::int))
  )
  WHERE "task_type" = 'subject_practice_observation'
    AND COALESCE("filter_snapshot"->'sealedObservationBatch'->>'batchId', '') <> '';
