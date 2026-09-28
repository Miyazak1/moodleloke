import type { GeneratedQuestionCandidate, ReviewResult } from '../ai-questioning/ai-questioning.types';

export const QUESTION_ENGINE_CANDIDATE_WRITE_GATE_VERSION = 'question-engine-candidate-write-gate-v1' as const;

type GateInput = {
  candidate: GeneratedQuestionCandidate;
  review: ReviewResult;
  generationMetadata: unknown;
  sourceSimilarity: unknown;
};

export type QuestionCandidateWriteGateResult = {
  policyVersion: typeof QUESTION_ENGINE_CANDIDATE_WRITE_GATE_VERSION;
  decision: 'allow_candidate_write' | 'allow_observation_evidence_write' | 'block';
  persistenceClass: 'candidate' | 'observation-evidence';
  blockers: string[];
  observedBlockers: string[];
  checks: {
    schema: 'passed' | 'blocked';
    sourceIsolation: 'passed' | 'blocked';
    duplicateRisk: 'passed' | 'blocked';
    quality: 'passed' | 'blocked';
  };
  evaluatedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function schemaBlockers(candidate: GeneratedQuestionCandidate) {
  const blockers: string[] = [];
  const optionIds = Array.isArray(candidate.options) ? candidate.options.map((option) => clean(option?.id)) : [];
  const optionTexts = Array.isArray(candidate.options) ? candidate.options.map((option) => clean(option?.text)) : [];
  if (!['math', 'physics', 'chemistry'].includes(clean(candidate.subject).toLowerCase())) blockers.push('schema_subject_invalid');
  if (!Number.isInteger(candidate.topicId) || candidate.topicId <= 0) blockers.push('schema_topic_id_invalid');
  if (!Number.isInteger(candidate.blueprintId) || candidate.blueprintId <= 0) blockers.push('schema_blueprint_id_invalid');
  if (candidate.sourceType !== 'ai') blockers.push('schema_source_type_invalid');
  if (!clean(candidate.prompt)) blockers.push('schema_prompt_missing');
  if (!clean(candidate.explanation)) blockers.push('schema_explanation_missing');
  if (!clean(candidate.questionType)) blockers.push('schema_question_type_missing');
  if (!clean(candidate.syllabusVersion)) blockers.push('schema_syllabus_version_missing');
  if (optionIds.length < 4) blockers.push('schema_options_insufficient');
  if (optionIds.some((id) => !id) || new Set(optionIds).size !== optionIds.length) blockers.push('schema_option_ids_invalid');
  if (optionTexts.some((value) => !value) || new Set(optionTexts.map((value) => value.toLowerCase())).size !== optionTexts.length) blockers.push('schema_option_texts_invalid');
  if (optionIds.filter((id) => id === clean(candidate.correctAnswer)).length !== 1) blockers.push('schema_correct_answer_invalid');
  return unique(blockers);
}

function sourceIsolationBlockers(generationMetadata: unknown) {
  const generation = record(generationMetadata);
  const generator = clean(generation.generator).toLowerCase();
  const sourceIsolation = record(generation.sourceIsolationEvidence);
  const automatedLeakage = record(generation.automatedCandidateLeakageGate);
  const externalProvider = Boolean(generator) && !['local-deterministic', 'rule-fallback', 'local-fallback', 'deterministic'].includes(generator);
  const blockers: string[] = [];
  if (externalProvider) {
    if (sourceIsolation.status !== 'enforced_structural_projection') blockers.push('source_isolation_not_enforced');
    if (sourceIsolation.originalQuestionContentOmitted !== true) blockers.push('source_original_content_not_omitted');
    if (sourceIsolation.reversibleSourceFieldsOmitted !== true) blockers.push('source_reversible_fields_not_omitted');
    if (sourceIsolation.sourceLinkageIdentifiersOmitted !== true) blockers.push('source_linkage_identifiers_not_omitted');
    if (Number(sourceIsolation.knownSourceLeakMatchCount) !== 0) blockers.push('source_known_leak_match');
    if (!/^[a-f0-9]{64}$/i.test(clean(sourceIsolation.providerProjectionSha256))) blockers.push('source_projection_digest_missing');
  }
  if (generator === 'local-deterministic' && clean(generation.intendedUse) === 'subject_practice'
    && clean(automatedLeakage.status) !== 'clear') {
    blockers.push('local_candidate_leakage_not_clear');
  }
  return unique(blockers);
}

function duplicateBlockers(review: ReviewResult, sourceSimilarity: unknown, generationMetadata: unknown) {
  const blockers: string[] = [];
  const issues = Array.isArray(review.issues) ? review.issues : [];
  const issueCodes = issues.map((issue) => clean(issue.code));
  if (issueCodes.includes('duplicate_prompt_risk')) blockers.push('duplicate_prompt_risk');
  if (issueCodes.includes('near_duplicate_prompt_risk')) blockers.push('near_duplicate_prompt_risk');
  const similarity = record(sourceSimilarity);
  if (typeof similarity.maxSimilarity === 'number' && similarity.maxSimilarity >= 0.72) blockers.push('source_similarity_high');
  const leakage = record(record(generationMetadata).automatedCandidateLeakageGate);
  if (leakage.blocked === true || (clean(leakage.status) && clean(leakage.status) !== 'clear')) blockers.push('candidate_leakage_detected');
  return unique(blockers);
}

function qualityBlockers(review: ReviewResult) {
  const blockers: string[] = [];
  const issues = Array.isArray(review.issues) ? review.issues : [];
  const dimensions = Array.isArray(review.dimensions) ? review.dimensions : [];
  if (review.status === 'failed') blockers.push('quality_review_failed');
  if (issues.some((issue) => issue.severity === 'error')) blockers.push('quality_error_issue');
  if (dimensions.some((dimension) => dimension.status === 'failed')) blockers.push('quality_failed_dimension');
  if (review.decision === 'regenerate') blockers.push('quality_regeneration_required');
  if (typeof review.score === 'number' && review.score < 70) blockers.push('quality_score_below_70');
  return unique(blockers);
}

export function evaluateQuestionCandidateWriteGate(input: GateInput): QuestionCandidateWriteGateResult {
  const generation = record(input.generationMetadata);
  const observation = clean(generation.workClass) === 'observation'
    && generation.suppressStudentPublication === true;
  const schema = schemaBlockers(input.candidate);
  const sourceIsolation = sourceIsolationBlockers(input.generationMetadata);
  const duplicateRisk = duplicateBlockers(input.review, input.sourceSimilarity, input.generationMetadata);
  const quality = qualityBlockers(input.review);
  const hardBlockers = observation
    ? unique([...schema, ...sourceIsolation])
    : unique([...schema, ...sourceIsolation, ...duplicateRisk, ...quality]);
  const observedBlockers = observation ? unique([...duplicateRisk, ...quality]) : [];
  return {
    policyVersion: QUESTION_ENGINE_CANDIDATE_WRITE_GATE_VERSION,
    decision: hardBlockers.length
      ? 'block'
      : observation ? 'allow_observation_evidence_write' : 'allow_candidate_write',
    persistenceClass: observation ? 'observation-evidence' : 'candidate',
    blockers: hardBlockers,
    observedBlockers,
    checks: {
      schema: schema.length ? 'blocked' : 'passed',
      sourceIsolation: sourceIsolation.length ? 'blocked' : 'passed',
      duplicateRisk: duplicateRisk.length ? 'blocked' : 'passed',
      quality: quality.length ? 'blocked' : 'passed'
    },
    evaluatedAt: new Date().toISOString()
  };
}
