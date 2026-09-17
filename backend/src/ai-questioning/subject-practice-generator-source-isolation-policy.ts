export const SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION =
  'question-generator-source-isolation-v3';

export const SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY =
  'single_generator_invocation_input' as const;

export const SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT =
  'approved_aggregate_profile_capability_difficulty_question_type_and_constraints_only' as const;

export const SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION =
  'question-generator-profile-aggregation-v1';

export const SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE = 5;

export const SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE =
  'controlled_enums_and_aggregate_numbers_only' as const;

export const SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_FORBIDDEN_SOURCE_FIELDS = Object.freeze([
  'original_prompt',
  'original_options',
  'original_answer',
  'original_explanation',
  'source_identity',
  'source_linkage_identifier',
  'reversible_source_payload'
] as const);

export type SubjectPracticeGeneratorSourceIsolationAudit = {
  policyVersion: typeof SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION;
  status: 'enforced_structural_projection';
  boundary: typeof SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY;
  allowedInput: typeof SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT;
  forbiddenSourceFields: readonly string[];
  originalQuestionContentOmitted: true;
  reversibleSourceFieldsOmitted: true;
  developerUnseenRequired: false;
  officialHoldoutRequiredForGeneratorIsolation: false;
  sourceLinkageIdentifiersOmitted: true;
  profileAggregationPolicyVersion: typeof SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION;
  profileMinimumSampleSize: number;
  profileProjectionMode: typeof SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE;
  providerProjectionReplayable: true;
  providerProjectionSha256: string;
};
