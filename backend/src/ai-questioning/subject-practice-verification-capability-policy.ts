export const SUBJECT_PRACTICE_VERIFICATION_CAPABILITY_POLICY_VERSION = 'subject-practice-verification-capability-v1';

export type SubjectPracticeVerificationCapabilityLevel =
  | 'deterministically_verified'
  | 'cross_model_verified'
  | 'insufficient_verification'
  | 'shadow_only';

export type SubjectPracticeVerificationBenchmarkStatus = 'qualified' | 'not_qualified' | 'not_run';

export type SubjectPracticeVerificationCapability = {
  policyVersion: string;
  subject: string;
  taskFamily: string;
  level: SubjectPracticeVerificationCapabilityLevel;
  automaticPublicationEligible: boolean;
  benchmarkStatus: SubjectPracticeVerificationBenchmarkStatus;
  deterministicCoverage: 'family_total' | 'partial_pattern_only' | 'none';
  blindReviewStatus: 'qualified_independent' | 'not_qualified' | 'not_implemented';
  currentEvidence: string[];
  limitations: string[];
  nextRequiredCapability: string;
};

export type SubjectPracticeVerificationEvidence = {
  benchmarkStatus?: SubjectPracticeVerificationBenchmarkStatus | null;
  deterministic?: {
    status?: 'verified' | 'conflict' | 'unparsed' | null;
    parsed?: boolean | null;
    selectedOptionId?: string | null;
    trueOptionIds?: string[] | null;
    agreesWithGenerator?: boolean | null;
    solverVersion?: string | null;
    verificationScopeId?: string | null;
    verificationScopeStatus?: 'matched' | 'mismatch' | 'missing_plan_contract' | null;
  } | null;
  blindReview?: {
    status?: 'verified' | 'disagreed' | 'abstained' | 'unavailable' | null;
    selectedOptionId?: string | null;
    trueOptionIds?: string[] | null;
    agreesWithGenerator?: boolean | null;
    independentProviderAndModel?: boolean | null;
    reviewerModelVersion?: string | null;
  } | null;
};

export type SubjectPracticeVerificationPublicationDecision = {
  policyVersion: string;
  publishable: boolean;
  capabilityLevel: SubjectPracticeVerificationCapabilityLevel;
  reasonCode:
    | 'verification_evidence_satisfied'
    | 'verification_capability_shadow_only'
    | 'verification_capability_insufficient'
    | 'verification_capability_not_publication_eligible'
    | 'verification_release_benchmark_not_qualified'
    | 'deterministic_solver_evidence_missing'
    | 'deterministic_solver_scope_mismatch'
    | 'deterministic_solver_answer_not_unique'
    | 'deterministic_solver_answer_disagrees'
    | 'blind_review_evidence_missing'
    | 'blind_review_not_independent'
    | 'blind_review_answer_not_unique'
    | 'blind_review_answer_disagrees';
};

type CapabilitySeed = Omit<SubjectPracticeVerificationCapability, 'policyVersion' | 'automaticPublicationEligible'>;

const CAPABILITY_SEEDS: CapabilitySeed[] = [
  {
    subject: 'math',
    taskFamily: 'elementary_function_direct_property',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_qualified',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: [
      'math_elementary_direct_property_solver_v1_subset',
      'programmatic_mutation_v3_gold_59_of_59_and_detection_236_of_236',
      'question_plan_scoped_rotation_gold_48_of_48_with_zero_scoped_mutation_false_accepts',
      'local_generator_v2_shadow_128_of_128_semantically_unique_ignoring_option_position_self_verified_plan_adherent_and_validator_blocking_free_at_zero_provider_cost',
      'post_freeze_seed_committed_random_property_v1_512_of_512_across_four_exact_scopes',
      'math_explanation_verifier_v1_bilingual_derivation_and_conclusion_128_of_128',
      'math_independent_oracle_v1_128_of_128_agreement_and_512_of_512_mutations_rejected_without_solver_or_generator_imports',
      'question_generator_source_isolation_v3_no_source_linkage_ids_controlled_aggregate_profile_recomputed_projection_hash',
      'offline_production_shadow_rehearsal_v1_128_of_128_suppressed_and_512_of_512_faults_blocked_non_qualifying',
      'production_shadow_evidence_protocol_v6_full_execution_and_generator_source_isolation_binding_hmac_attested',
      'formal_verification_orchestrator_v1_persisted_solver_explanation_and_independent_oracle_bundle',
      'local_generator_shadow_routing_v1_zero_provider_exact_scope_fail_closed_no_paid_fallback',
      'trusted_production_shadow_exporter_v5_recomputed_provider_projection_hash_conflicts_retained_and_read_only_cli_ready',
      'source_corpus_release_qualification_v1_attested_complete_scan_plus_matching_opaque_calibration_fixture_only',
      'local_blind_audit_v1_deterministic_stratified_32_item_answer_separated_hash_bound_preview',
      'local_blind_audit_score_v1_fail_closed_integrity_attestation_and_per_scope_quality_fixtures',
      'production_candidate_replay_609_610_verified_and_611_multiple_true_options_detected'
    ],
    limitations: [
      'solver_covers_only_restricted_log_domain_linear_radical_domain_and_interval_monotonicity_exponential_range_and_positive_integer_power_value_or_property_claims',
      'local_generator_and_independent_oracle_are_shadow_only_without_suppressed_production_shadow_release_evidence',
      'exact_scopes_not_yet_qualified_by_trusted_production_shadow',
      'full_known_source_corpus_profile_admission_and_generator_projection_scan_evidence_missing',
      'blind_reviewer_not_yet_independent_or_release_qualified'
    ],
    nextRequiredCapability: 'run_current_full_known_source_corpus_two_layer_scan_then_trusted_publication_suppressed_production_shadow_per_exact_scope'
  },
  {
    subject: 'math',
    taskFamily: 'elementary_function_exp_log_ordering',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'none',
    blindReviewStatus: 'not_qualified',
    currentEvidence: ['question_plan_shape_and_current_policy_replay_only'],
    limitations: ['no_independent_expression_order_solver', 'three_sample_rotation_batch_is_not_release_evidence'],
    nextRequiredCapability: 'exact_or_high_precision_expression_order_solver_with_interval_bounds'
  },
  {
    subject: 'math',
    taskFamily: 'arithmetic_sequence_two_condition_solve_a1_d',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: ['bounded_arithmetic_sequence_numeric_pattern_check'],
    limitations: ['current_parser_does_not_cover_the_full_classified_family_grammar'],
    nextRequiredCapability: 'family_grammar_and_total_sequence_constraint_solver'
  },
  {
    subject: 'physics',
    taskFamily: 'kinematics_basic_direct_relation',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_qualified',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: [
      'physics_basic_kinematics_solver_v2_typed_si_quantity_subset',
      'programmatic_mutation_v2_gold_128_of_128_and_detection_512_of_512_with_zero_false_accepts',
      'question_plan_scope_bound_four_direct_kinematics_relations',
      'local_generator_v1_shadow_512_of_512_semantically_unique_self_verified_plan_adherent_and_validator_blocking_free_at_zero_provider_cost',
      'post_freeze_seed_committed_random_property_v1_512_of_512_across_four_exact_scopes',
      'physics_kinematics_explanation_verifier_v1_bilingual_formula_inputs_units_and_conclusion_512_of_512',
      'physics_independent_oracle_v1_512_of_512_agreement_and_2048_of_2048_mutations_rejected_without_solver_or_generator_imports',
      'question_generator_source_isolation_v3_no_source_linkage_ids_controlled_aggregate_profile_recomputed_projection_hash',
      'offline_production_shadow_rehearsal_v1_512_of_512_suppressed_and_2048_of_2048_faults_blocked_non_qualifying',
      'production_shadow_evidence_protocol_v6_full_execution_and_generator_source_isolation_binding_hmac_attested',
      'formal_verification_orchestrator_v1_persisted_solver_explanation_and_independent_oracle_bundle',
      'local_generator_shadow_routing_v1_zero_provider_exact_scope_fail_closed_no_paid_fallback',
      'trusted_production_shadow_exporter_v5_recomputed_provider_projection_hash_conflicts_retained_and_read_only_cli_ready',
      'source_corpus_release_qualification_v1_attested_complete_scan_plus_matching_opaque_calibration_fixture_only'
    ],
    limitations: [
      'solver_covers_only_four_direct_text_relation_grammars',
      'motion_graph_direction_and_unrestricted_natural_language_relations_remain_unparsed',
      'local_generator_and_independent_oracle_are_shadow_only_without_suppressed_production_shadow_release_evidence',
      'exact_scopes_not_yet_qualified_by_trusted_production_shadow',
      'full_known_source_corpus_profile_admission_and_generator_projection_scan_evidence_missing'
    ],
    nextRequiredCapability: 'run_current_full_known_source_corpus_two_layer_scan_then_trusted_publication_suppressed_production_shadow_per_exact_scope_then_expand_machine_readable_relations'
  },
  {
    subject: 'physics',
    taskFamily: 'kinematics_constant_acceleration_direct',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: ['bounded_speed_and_acceleration_numeric_checks', 'unit_family_checks'],
    limitations: ['no_family_total_equation_selection_or_condition_parser'],
    nextRequiredCapability: 'typed_quantity_and_unit_solver_for_restricted_one_dimensional_kinematics'
  },
  {
    subject: 'physics',
    taskFamily: 'kinematics_motion_graph_interpretation',
    level: 'shadow_only',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'none',
    blindReviewStatus: 'not_qualified',
    currentEvidence: ['task_family_and_question_plan_visibility_only'],
    limitations: ['graph_asset_has_no_machine_readable_semantics'],
    nextRequiredCapability: 'machine_readable_graph_spec_and_graph_solver'
  },
  {
    subject: 'chemistry',
    taskFamily: 'notation_balanced_equation_evidence_chain',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: ['displayed_equation_element_balance_check'],
    limitations: ['atom_balance_does_not_prove_reagents_products_conditions_or_unique_option_correctness'],
    nextRequiredCapability: 'reaction_semantics_and_per_option_equation_verification'
  },
  {
    subject: 'chemistry',
    taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    level: 'insufficient_verification',
    benchmarkStatus: 'not_qualified',
    deterministicCoverage: 'partial_pattern_only',
    blindReviewStatus: 'not_qualified',
    currentEvidence: [
      'chemistry_strong_acid_base_solver_v3_complete_dissociation_subset_with_concentration_volume_dilution',
      'programmatic_mutation_v3_gold_128_of_128_and_detection_512_of_512_with_zero_false_accepts',
      'exact_question_plan_bound_family_scope_for_acid_dilution_base_dilution_and_neutralization_for_ph_or_character',
      'local_generator_v2_self_verified_validator_clean_semantically_unique_192_of_192_at_zero_provider_calls',
      'post_freeze_seed_committed_random_property_v1_768_of_768_across_six_exact_scopes',
      'chemistry_explanation_verifier_v1_bilingual_formula_inputs_temperature_assumptions_and_conclusion_192_of_192',
      'chemistry_independent_oracle_v1_192_of_192_agreement_and_768_of_768_mutations_rejected_without_solver_or_generator_imports',
      'question_generator_source_isolation_v3_no_source_linkage_ids_controlled_aggregate_profile_recomputed_projection_hash',
      'offline_production_shadow_rehearsal_v1_192_of_192_suppressed_and_768_of_768_faults_blocked_non_qualifying',
      'production_shadow_evidence_protocol_v6_full_execution_and_generator_source_isolation_binding_hmac_attested',
      'formal_verification_orchestrator_v1_persisted_solver_explanation_and_independent_oracle_bundle',
      'local_generator_shadow_routing_v1_zero_provider_exact_scope_fail_closed_no_paid_fallback',
      'trusted_production_shadow_exporter_v5_recomputed_provider_projection_hash_conflicts_retained_and_read_only_cli_ready',
      'source_corpus_release_qualification_v1_attested_complete_scan_plus_matching_opaque_calibration_fixture_only'
    ],
    limitations: [
      'solver_is_limited_to_monoprotic_strong_acid_and_monohydroxide_strong_base_at_25_celsius',
      'weak_acid_weak_base_polyprotic_buffer_hydrolysis_activity_and_titration_relations_remain_unparsed',
      'local_generator_and_independent_oracle_are_shadow_only_without_suppressed_production_shadow_release_evidence',
      'exact_scopes_not_yet_qualified_by_trusted_production_shadow',
      'full_known_source_corpus_profile_admission_and_generator_projection_scan_evidence_missing'
    ],
    nextRequiredCapability: 'run_current_full_known_source_corpus_two_layer_scan_then_trusted_publication_suppressed_production_shadow_per_exact_scope_then_expand_beyond_complete_dissociation_subset'
  }
];

const MACHINE_UNREADABLE_REPRESENTATIONS = new Set(['graph', 'diagram', 'circuit']);

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function materialize(seed: CapabilitySeed): SubjectPracticeVerificationCapability {
  const automaticPublicationEligible = (seed.level === 'deterministically_verified' || seed.level === 'cross_model_verified')
    && seed.benchmarkStatus === 'qualified';
  return {
    ...seed,
    currentEvidence: [...seed.currentEvidence],
    limitations: [...seed.limitations],
    policyVersion: SUBJECT_PRACTICE_VERIFICATION_CAPABILITY_POLICY_VERSION,
    automaticPublicationEligible
  };
}

export function subjectPracticeVerificationCapabilityRegistry() {
  return CAPABILITY_SEEDS.map(materialize);
}

export function subjectPracticeVerificationCapabilityFor(input: {
  subject?: string | null;
  taskFamily?: string | null;
  representationType?: string | null;
}): SubjectPracticeVerificationCapability {
  const subject = clean(input.subject);
  const taskFamily = clean(input.taskFamily) || 'other';
  const representationType = clean(input.representationType);
  const registered = CAPABILITY_SEEDS.find((entry) => entry.subject === subject && entry.taskFamily === taskFamily);
  if (registered) return materialize(registered);
  const machineUnreadable = MACHINE_UNREADABLE_REPRESENTATIONS.has(representationType);
  return materialize({
    subject: subject || 'unknown',
    taskFamily,
    level: 'shadow_only',
    benchmarkStatus: 'not_run',
    deterministicCoverage: 'none',
    blindReviewStatus: 'not_implemented',
    currentEvidence: [],
    limitations: [machineUnreadable ? 'representation_not_machine_readable' : 'task_family_not_registered_for_independent_verification'],
    nextRequiredCapability: machineUnreadable
      ? 'machine_readable_representation_and_solver'
      : 'register_family_verification_contract_and_release_benchmark'
  });
}

function exactlyOneOption(value: string[] | null | undefined, selectedOptionId: string | null | undefined) {
  return Array.isArray(value) && value.length === 1 && Boolean(selectedOptionId) && value[0] === selectedOptionId;
}

export function subjectPracticeVerificationPublicationDecision(input: {
  capability: SubjectPracticeVerificationCapability;
  evidence?: SubjectPracticeVerificationEvidence | null;
}): SubjectPracticeVerificationPublicationDecision {
  const { capability } = input;
  const evidence = input.evidence ?? {};
  const base = {
    policyVersion: SUBJECT_PRACTICE_VERIFICATION_CAPABILITY_POLICY_VERSION,
    capabilityLevel: capability.level
  };
  if (capability.level === 'shadow_only') return { ...base, publishable: false, reasonCode: 'verification_capability_shadow_only' };
  if (capability.level === 'insufficient_verification') return { ...base, publishable: false, reasonCode: 'verification_capability_insufficient' };
  if (!capability.automaticPublicationEligible) {
    return { ...base, publishable: false, reasonCode: 'verification_capability_not_publication_eligible' };
  }
  if (capability.benchmarkStatus !== 'qualified' || evidence.benchmarkStatus !== 'qualified') {
    return { ...base, publishable: false, reasonCode: 'verification_release_benchmark_not_qualified' };
  }
  if (capability.level === 'deterministically_verified') {
    const deterministic = evidence.deterministic;
    if (!deterministic || deterministic.status !== 'verified' || deterministic.parsed !== true || !deterministic.solverVersion) {
      return { ...base, publishable: false, reasonCode: 'deterministic_solver_evidence_missing' };
    }
    if (deterministic.verificationScopeStatus !== 'matched' || !deterministic.verificationScopeId) {
      return { ...base, publishable: false, reasonCode: 'deterministic_solver_scope_mismatch' };
    }
    if (!exactlyOneOption(deterministic.trueOptionIds, deterministic.selectedOptionId)) {
      return { ...base, publishable: false, reasonCode: 'deterministic_solver_answer_not_unique' };
    }
    if (deterministic.agreesWithGenerator !== true) {
      return { ...base, publishable: false, reasonCode: 'deterministic_solver_answer_disagrees' };
    }
    return { ...base, publishable: true, reasonCode: 'verification_evidence_satisfied' };
  }
  const blindReview = evidence.blindReview;
  if (!blindReview || blindReview.status !== 'verified' || !blindReview.reviewerModelVersion) {
    return { ...base, publishable: false, reasonCode: 'blind_review_evidence_missing' };
  }
  if (blindReview.independentProviderAndModel !== true) {
    return { ...base, publishable: false, reasonCode: 'blind_review_not_independent' };
  }
  if (!exactlyOneOption(blindReview.trueOptionIds, blindReview.selectedOptionId)) {
    return { ...base, publishable: false, reasonCode: 'blind_review_answer_not_unique' };
  }
  if (blindReview.agreesWithGenerator !== true) {
    return { ...base, publishable: false, reasonCode: 'blind_review_answer_disagrees' };
  }
  return { ...base, publishable: true, reasonCode: 'verification_evidence_satisfied' };
}
