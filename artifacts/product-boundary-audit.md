# Product boundary audit

Generated: 2026-09-24T03:53:05.048Z

## Frontend

- student-agent: 140
- admin-authoring: 94
- teaching-assets: 0
- obsolete-candidate: 0

## Backend areas

| Area | Total | Reachable | Unreachable |
| --- | ---: | ---: | ---: |
| (root) | 2 | 1 | 1 |
| admin-audit | 5 | 1 | 4 |
| agent | 44 | 44 | 0 |
| ai-gateway | 12 | 12 | 0 |
| ai-questioning | 83 | 60 | 23 |
| auth | 12 | 12 | 0 |
| common | 7 | 6 | 1 |
| csca-learning | 4 | 4 | 0 |
| csca-mock-exam | 6 | 6 | 0 |
| csca-special-practice | 20 | 20 | 0 |
| health | 2 | 2 | 0 |
| learning-intelligence | 27 | 26 | 1 |
| me | 4 | 4 | 0 |
| ops | 2 | 0 | 2 |
| past-papers | 5 | 5 | 0 |
| prisma | 2 | 2 | 0 |
| schools | 11 | 11 | 0 |
| score-calibration | 6 | 0 | 6 |

## Prisma review candidates

Static absence is not deletion authority; relations, raw SQL and migration compatibility still require review.

- PublicContentBlock
- CityGuide
- ApplicationTimelineWindow
- SchoolRaw
- PracticeQuestion
- PracticeAttempt
- CscaQuestionStyleProfile
- CscaExamSeriesProfile
- CscaGenerationProfile
- CscaQuestionQualityMetric
- CscaSubjectPracticeProductionRun
- CscaSubjectPracticeProductionCell
- CscaAiQuestioningTask
- CscaAiQuestioningSetting
- OrganizationCohort
- CscaAIReviewDecision
- CscaLearningCohort
- CscaStudentLearningCycle
- CscaAdaptiveUsageAggregate
- CscaAdaptiveInventorySnapshot
- CscaAdaptiveInventoryEvent
- MockExamBlueprint
- MockExamBlueprintSlot
- CartItem
- Order
- OrderItem
- Payment
- PaymentCallbackLog
- StudentScoreGoalSubject
- StudentExamOutcome
- StudentExamOutcomeEvent
- ForecastCalibrationDatasetManifest
- ForecastCalibrationDatasetRow
- ScoreCalibrationGovernanceEvent
