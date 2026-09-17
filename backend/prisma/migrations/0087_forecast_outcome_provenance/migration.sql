ALTER TABLE "forecast_calibration_snapshots"
  ADD COLUMN "outcome_source" VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown';

ALTER TABLE "forecast_calibration_snapshots"
  ADD CONSTRAINT "forecast_calibration_snapshots_outcome_source_check"
  CHECK ("outcome_source" IN ('legacy_unknown', 'verified_csca_exam', 'timed_mock_proxy'));

-- Existing snapshots predate explicit provenance and remain auditable as legacy_unknown.
-- PostgreSQL enforces this rule for all new/updated rows without pretending old rows were verified.
ALTER TABLE "forecast_calibration_snapshots"
  ADD CONSTRAINT "forecast_calibration_snapshots_qualified_source_check"
  CHECK ("status" <> 'qualified' OR "outcome_source" = 'verified_csca_exam') NOT VALID;
