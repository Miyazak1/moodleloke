ALTER TABLE "csca_question_quality_metrics"
  ADD COLUMN "option_selection_stats" JSONB,
  ADD COLUMN "most_selected_wrong_option" VARCHAR(50);

CREATE INDEX "idx_csca_question_quality_wrong_option"
  ON "csca_question_quality_metrics" ("most_selected_wrong_option")
  WHERE "most_selected_wrong_option" IS NOT NULL;
