# Prisma model retention matrix

Policy: copy all models during initial migration; prune only after relation, SQL, migration and rollback review.

| Model | Table | Disposition | Evidence |
| --- | --- | --- | --- |
| User | users | runtime-keep | Referenced by the reachable backend runtime. |
| StudentProfile | student_profiles | runtime-keep | Referenced by the reachable backend runtime. |
| AuthEmailToken | auth_email_tokens | runtime-keep | Referenced by the reachable backend runtime. |
| OAuthAccount | oauth_accounts | runtime-keep | Referenced by the reachable backend runtime. |
| RefreshSession | refresh_sessions | runtime-keep | Referenced by the reachable backend runtime. |
| PublicContentBlock | content_blocks | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| CityGuide | city_guides | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| ApplicationTimelineWindow | application_timeline_windows | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| AdminAuditLog | admin_audit_logs | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolRaw | schools_raw | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| School | schools | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolProgram | school_programs | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolCscaRule | school_csca_rules | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolScholarship | school_scholarships | runtime-keep | Referenced by the reachable backend runtime. |
| Scholarship | scholarships | runtime-keep | Referenced by the reachable backend runtime. |
| ScholarshipSchool | scholarship_schools | runtime-keep | Referenced by the reachable backend runtime. |
| ScholarshipProgram | scholarship_programs | runtime-keep | Referenced by the reachable backend runtime. |
| SavedSchool | saved_schools | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolCompareItem | school_compare_items | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolChangeLog | school_change_logs | runtime-keep | Referenced by the reachable backend runtime. |
| SchoolSnapshot | school_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| PracticeQuestion | practice_questions | manual-review | No direct runtime reference; relation and migration review required. |
| PracticeAttempt | practice_attempts | manual-review | No direct runtime reference; relation and migration review required. |
| SpecialPracticeTopic | special_practice_topics | runtime-keep | Referenced by the reachable backend runtime. |
| SpecialPracticeQuestion | special_practice_questions | runtime-keep | Referenced by the reachable backend runtime. |
| SpecialPracticeSession | special_practice_sessions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaExamTopic | csca_exam_topics | runtime-keep | Referenced by the reachable backend runtime. |
| CscaSourceDocument | csca_source_documents | runtime-keep | Referenced by the reachable backend runtime. |
| CscaSourceQuestion | csca_source_questions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestionStyleProfile | csca_question_style_profiles | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaExamSeriesProfile | csca_exam_series_profiles | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaGenerationProfile | csca_generation_profiles | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaSyllabusImport | csca_syllabus_imports | runtime-keep | Referenced by the reachable backend runtime. |
| CscaTopicMapping | csca_topic_mappings | runtime-keep | Referenced by the reachable backend runtime. |
| UserCscaTopicMastery | user_csca_topic_mastery | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAdaptiveSession | csca_adaptive_sessions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAdaptiveRound | csca_adaptive_rounds | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAdaptiveRoundItem | csca_adaptive_round_items | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestionExposure | csca_question_exposures | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestionBlueprint | csca_question_blueprints | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestion | csca_questions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestionMisconception | csca_question_misconceptions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaConceptCard | csca_concept_cards | runtime-keep | Referenced by the reachable backend runtime. |
| TeachingAsset | teaching_assets | runtime-keep | Referenced by the reachable backend runtime. |
| TeachingAssetVersion | teaching_asset_versions | runtime-keep | Referenced by the reachable backend runtime. |
| TeachingAssetTopic | teaching_asset_topics | runtime-keep | Referenced by the reachable backend runtime. |
| TeachingAssetExposure | teaching_asset_exposures | runtime-keep | Referenced by the reachable backend runtime. |
| TeachingInteractionEvent | teaching_interaction_events | runtime-keep | Referenced by the reachable backend runtime. |
| CscaQuestionQualityMetric | csca_question_quality_metrics | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAiGenerationJob | csca_ai_generation_jobs | runtime-keep | Referenced by the reachable backend runtime. |
| CscaSubjectPracticeProductionRun | csca_subject_practice_production_runs | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaSubjectPracticeProductionCell | csca_subject_practice_production_cells | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAiQuestioningTask | csca_ai_questioning_tasks | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAiQuestioningSetting | csca_ai_questioning_settings | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| Organization | organizations | runtime-keep | Referenced by the reachable backend runtime. |
| OrganizationMember | organization_members | runtime-keep | Referenced by the reachable backend runtime. |
| OrganizationCohort | organization_cohorts | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| OrganizationInvite | organization_invites | runtime-keep | Referenced by the reachable backend runtime. |
| OrganizationInviteAttempt | organization_invite_attempts | runtime-keep | Referenced by the reachable backend runtime. |
| OrganizationAiCreditPool | organization_ai_credit_pools | runtime-keep | Referenced by the reachable backend runtime. |
| OrganizationLlmProviderConfig | organization_llm_provider_configs | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAIInteraction | csca_ai_interactions | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAIReviewDecision | csca_ai_review_decisions | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAIInteractionFeedback | csca_ai_interaction_feedback | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAIEntitlementAccount | csca_ai_entitlement_accounts | runtime-keep | Referenced by the reachable backend runtime. |
| CscaAIUsageLedger | csca_ai_usage_ledger | runtime-keep | Referenced by the reachable backend runtime. |
| AiGatewayCallLog | ai_gateway_call_logs | runtime-keep | Referenced by the reachable backend runtime. |
| CscaTrainingEvent | csca_training_events | runtime-keep | Referenced by the reachable backend runtime. |
| CscaLearningCohort | csca_learning_cohorts | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaStudentLearningCycle | csca_student_learning_cycles | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAdaptiveUsageAggregate | csca_adaptive_usage_aggregates | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAdaptiveInventorySnapshot | csca_adaptive_inventory_snapshots | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaAdaptiveInventoryEvent | csca_adaptive_inventory_events | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| CscaLearningDailySnapshot | csca_learning_daily_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| CscaLearningStreak | csca_learning_streaks | runtime-keep | Referenced by the reachable backend runtime. |
| CscaLearningInsight | csca_learning_insights | runtime-keep | Referenced by the reachable backend runtime. |
| CscaReadinessActionCalibrationSnapshot | csca_readiness_action_calibration_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| CscaWrongPattern | csca_wrong_patterns | runtime-keep | Referenced by the reachable backend runtime. |
| MockExamPaper | mock_exam_papers | runtime-keep | Referenced by the reachable backend runtime. |
| MockExamQuestion | mock_exam_questions | runtime-keep | Referenced by the reachable backend runtime. |
| MockExamBlueprint | mock_exam_blueprints | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| MockExamBlueprintSlot | mock_exam_blueprint_slots | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| MockExamGenerationJob | mock_exam_generation_jobs | runtime-keep | Referenced by the reachable backend runtime. |
| MockExamAttempt | mock_exam_attempts | runtime-keep | Referenced by the reachable backend runtime. |
| PastPaper | past_papers | runtime-keep | Referenced by the reachable backend runtime. |
| AgentPastPaperAttempt | agent_past_paper_attempts | runtime-keep | Referenced by the reachable backend runtime. |
| ResourceBundle | resource_bundles | runtime-keep | Referenced by the reachable backend runtime. |
| ResourceBundleItem | resource_bundle_items | runtime-keep | Referenced by the reachable backend runtime. |
| PastPaperFile | past_paper_files | runtime-keep | Referenced by the reachable backend runtime. |
| PastPaperDownload | past_paper_downloads | runtime-keep | Referenced by the reachable backend runtime. |
| CartItem | cart_items | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| Order | orders | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| OrderItem | order_items | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| Payment | payments | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| PaymentCallbackLog | payment_callback_logs | legacy-archive-candidate | Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain. |
| StudentScoreGoal | student_score_goals | runtime-keep | Referenced by the reachable backend runtime. |
| StudentScoreGoalSubject | student_score_goal_subjects | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| StudyAvailabilityPreference | study_availability_preferences | runtime-keep | Referenced by the reachable backend runtime. |
| LearningEvidenceEvent | learning_evidence_events | runtime-keep | Referenced by the reachable backend runtime. |
| LearningEvidenceRetraction | learning_evidence_retractions | runtime-keep | Referenced by the reachable backend runtime. |
| LearningEvidenceOutbox | learning_evidence_outbox | runtime-keep | Referenced by the reachable backend runtime. |
| UserCscaTopicStateV2 | user_csca_topic_states_v2 | runtime-keep | Referenced by the reachable backend runtime. |
| LearningStateProjectionCheckpoint | learning_state_projection_checkpoints | runtime-keep | Referenced by the reachable backend runtime. |
| TargetGapSnapshot | target_gap_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| LearningPrescription | learning_prescriptions | runtime-keep | Referenced by the reachable backend runtime. |
| LearningDecisionCurrent | learning_decision_current | runtime-keep | Referenced by the reachable backend runtime. |
| LearningIntervention | learning_interventions | runtime-keep | Referenced by the reachable backend runtime. |
| LearningInterventionDelivery | learning_intervention_deliveries | runtime-keep | Referenced by the reachable backend runtime. |
| LearningInterventionStep | learning_intervention_steps | runtime-keep | Referenced by the reachable backend runtime. |
| LearningInterventionVerification | learning_intervention_verifications | runtime-keep | Referenced by the reachable backend runtime. |
| LearningInterventionOutcome | learning_intervention_outcomes | runtime-keep | Referenced by the reachable backend runtime. |
| LearningInterventionStabilityAssessment | learning_intervention_stability_assessments | runtime-keep | Referenced by the reachable backend runtime. |
| LearningPrescriptionOutcome | learning_prescription_outcomes | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyRequest | question_supply_requests | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyFulfillmentPlan | question_supply_fulfillment_plans | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyFulfillmentEvent | question_supply_fulfillment_events | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyRecoveryConfirmation | question_supply_recovery_confirmations | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyInventoryCheck | question_supply_inventory_checks | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplySchedulerState | question_supply_scheduler_states | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplySchedulerRun | question_supply_scheduler_runs | runtime-keep | Referenced by the reachable backend runtime. |
| QuestionSupplyRequestEvent | question_supply_request_events | runtime-keep | Referenced by the reachable backend runtime. |
| AssessmentItemExposure | assessment_item_exposures | runtime-keep | Referenced by the reachable backend runtime. |
| ScoreReadinessForecast | score_readiness_forecasts | runtime-keep | Referenced by the reachable backend runtime. |
| ScorePredictionShadowRun | score_prediction_shadow_runs | runtime-keep | Referenced by the reachable backend runtime. |
| ExamScoringPolicy | exam_scoring_policies | runtime-keep | Referenced by the reachable backend runtime. |
| ItemCalibrationSnapshot | item_calibration_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| ForecastCalibrationSnapshot | forecast_calibration_snapshots | runtime-keep | Referenced by the reachable backend runtime. |
| StudentExamOutcome | student_exam_outcomes | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| StudentExamOutcomeEvidence | student_exam_outcome_evidence | runtime-keep | Referenced by the reachable backend runtime. |
| StudentExamOutcomeEvent | student_exam_outcome_events | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| ForecastCalibrationDatasetManifest | forecast_calibration_dataset_manifests | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| ForecastCalibrationDatasetRow | forecast_calibration_dataset_rows | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| ScoreCalibrationGovernanceEvent | score_calibration_governance_events | future-platform-keep | Reserved for Agent learning, authoring, assessment, or future teaching platform capability. |
| AgentConversation | agent_conversations | runtime-keep | Referenced by the reachable backend runtime. |
| AgentMessage | agent_messages | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachment | agent_attachments | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentPage | agent_attachment_pages | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentChunk | agent_attachment_chunks | runtime-keep | Referenced by the reachable backend runtime. |
| AgentMessageAttachment | agent_message_attachments | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentAnalysis | agent_attachment_analyses | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentAnalysisItem | agent_attachment_analysis_items | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentQuestionMatch | agent_attachment_question_matches | runtime-keep | Referenced by the reachable backend runtime. |
| AgentAttachmentEvidenceCandidate | agent_attachment_evidence_candidates | runtime-keep | Referenced by the reachable backend runtime. |
| AgentRun | agent_runs | runtime-keep | Referenced by the reachable backend runtime. |
| AgentToolCall | agent_tool_calls | runtime-keep | Referenced by the reachable backend runtime. |
| AgentArtifact | agent_artifacts | runtime-keep | Referenced by the reachable backend runtime. |
| AgentOutbox | agent_outbox | runtime-keep | Referenced by the reachable backend runtime. |
