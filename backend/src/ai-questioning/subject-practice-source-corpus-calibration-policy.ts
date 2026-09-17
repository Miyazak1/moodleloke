import { createHash } from 'node:crypto';
import {
  classifySubjectPracticeSourceLengthWithQualification,
  SubjectPracticeSourceCorpusLengthQualification,
  subjectPracticeSourceCorpusLengthQualificationMatches
} from './subject-practice-source-corpus-length-policy';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_POLICY_VERSION =
  'subject-practice-source-corpus-calibration-policy-v9';
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALIFICATION_VERSION =
  'subject-practice-source-corpus-calibration-quality-opaque-qualification-v2';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS = ['math', 'physics', 'chemistry'] as const;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES = ['en', 'zh'] as const;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS =
  ['prompt', 'options', 'answer', 'explanation', 'localizations'] as const;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS =
  ['short', 'medium', 'long'] as const;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BOUNDARIES = Object.freeze({
  shortMaximumNormalizedCharacters: 24,
  mediumMaximumNormalizedCharacters: 79
});
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_COVERAGE_MINIMUM_PER_CLASS_PER_CELL = 20;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS = Object.freeze({
  minimumPerClassPerCell: 200,
  maximumFalseNegativeWilson95Upper: 0.02,
  maximumFalsePositiveWilson95Upper: 0.05,
  maximumRejectAbstainRate: 0.05,
  maximumAllowAbstainRate: 0.1
});
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_RELEASE_MINIMUM_PER_CLASS_PER_CELL = 200;
export const SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_LIMITS = Object.freeze({
  maximumFalseNegativeWilson95Upper: 0.02,
  maximumFalsePositiveWilson95Upper: 0.05,
  maximumRejectAbstainRate: 0.1,
  maximumAllowAbstainRate: 0.1
});

export const SUBJECT_PRACTICE_SOURCE_CORPUS_TRUTH_LABELS = [
  'exact_or_format_duplicate', 'near_duplicate_same_source', 'structural_duplicate',
  'same_archetype_allowed', 'distinct', 'ambiguous_excluded'
] as const;

export const SUBJECT_PRACTICE_SOURCE_CORPUS_DERIVATION_KINDS = [
  'verbatim_copy', 'punctuation_spacing_or_latex_change', 'option_reordering',
  'entity_only_substitution', 'light_numeric_change', 'cross_field_splice',
  'short_source_in_long_text', 'same_source_translation', 'light_paraphrase',
  'formula_isomorphism', 'reasoning_graph_isomorphism', 'answer_position_change',
  'shared_syllabus_terms', 'shared_formula_different_task',
  'shared_question_type_distinct_values_and_context', 'unavoidable_standard_definition',
  'independently_distinct_question', 'unresolved_historical_pair', 'short_common_field_value'
] as const;

type Subject = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS[number];
type Language = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES[number];
type SourceField = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS[number];
type LengthBucket = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS[number];
type TruthLabel = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_TRUTH_LABELS[number];
type DerivationKind = typeof SUBJECT_PRACTICE_SOURCE_CORPUS_DERIVATION_KINDS[number];
type ExpectedAction = 'reject' | 'allow' | 'exclude';
type PredictedAction = 'reject' | 'allow' | 'abstain';

export type SubjectPracticeSourceCorpusCalibrationExample = {
  id: string;
  subject: Subject;
  language: Language;
  sourceField: SourceField;
  sourceLengthBucket: LengthBucket;
  sourceNormalizedCharacterCount?: number;
  targetLengthBucket: LengthBucket;
  targetNormalizedCharacterCount?: number;
  truthLabel: TruthLabel;
  expectedAction: ExpectedAction;
  predictedAction: PredictedAction;
  labelProvenance: 'mutation_proven' | 'same_source_derived' | 'human_gold' | 'independently_distinct' | 'formal_graph_proven';
  formalGraphQualificationSha256?: string;
  inventorySnapshotSha256?: string;
  sourceQuestionId: string;
  candidateQuestionId: string;
  sourceFamilyId: string;
  candidateFamilyId: string;
  sourceLineageId: string;
  candidateLineageId: string;
  derivationId: string;
  mutationChain: DerivationKind[];
  languageRelation: 'same_language' | 'same_source_translation' | 'cross_source_language_pair';
  fieldRelation: 'same_field' | 'cross_field';
  expectedInvariances: string[];
  split: 'calibration' | 'test';
  sourceContentSha256: string;
  candidateContentSha256: string;
};

export type SubjectPracticeSourceCorpusCalibrationCell = {
  subject: Subject;
  language: Language;
  sourceField: SourceField;
  targetLengthBucket: LengthBucket;
  rejectCount: number;
  allowCount: number;
  excludedCount: number;
  abstainCount: number;
  rejectAbstainCount: number;
  allowAbstainCount: number;
  rejectAbstainRate: number | null;
  allowAbstainRate: number | null;
  falseNegativeCount: number;
  falsePositiveCount: number;
  falseNegativeRate: number | null;
  falsePositiveRate: number | null;
  falseNegativeWilson95: { lower: number; upper: number } | null;
  falsePositiveWilson95: { lower: number; upper: number } | null;
};

export type SubjectPracticeSourceCorpusCalibrationQualityQualification = Readonly<{
  kind: 'subject_practice_source_corpus_calibration_quality_qualification';
  qualificationVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALIFICATION_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_POLICY_VERSION;
  datasetSnapshotSha256: string;
  inventoryManifestSha256: string;
  inventorySnapshotSha256: string;
  generatorVersionSetSha256: string;
  rendererVersionSetSha256: string;
  lengthPolicyQualificationSha256: string;
  qualityThresholdsSha256: string;
  primaryReachableCellSetSha256: string;
  qualificationSha256: string;
}>;

export type SubjectPracticeSourceCorpusCalibrationSourceLengthMarginal =
  Omit<SubjectPracticeSourceCorpusCalibrationCell, 'targetLengthBucket'> & {
    sourceLengthBucket: LengthBucket;
  };

const REJECT_LABELS = new Set<TruthLabel>([
  'exact_or_format_duplicate', 'near_duplicate_same_source', 'structural_duplicate'
]);
const ALLOW_LABELS = new Set<TruthLabel>(['same_archetype_allowed', 'distinct']);
const trustedCalibrationQualityQualifications = new WeakSet<object>();

function clean(value: unknown) { return String(value ?? '').trim(); }
function validSha256(value: unknown) { return /^[a-f0-9]{64}$/.test(clean(value)); }
function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}
function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalJsonValue(value))).digest('hex');
}
export function subjectPracticeSourceCorpusCalibrationReachableCellSetSha256(cellKeys: string[]) {
  return sha256([...cellKeys].sort());
}
function rate(numerator: number, denominator: number) { return denominator ? numerator / denominator : null; }
function cellKey(subject: Subject, language: Language, sourceField: SourceField, targetLengthBucket: LengthBucket) {
  return `${subject}:${language}:${sourceField}:${targetLengthBucket}`;
}
export function classifySubjectPracticeSourceCorpusCalibrationLength(normalizedCharacterCount: number): LengthBucket {
  if (normalizedCharacterCount <= SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BOUNDARIES.shortMaximumNormalizedCharacters) {
    return 'short';
  }
  if (normalizedCharacterCount <= SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BOUNDARIES.mediumMaximumNormalizedCharacters) {
    return 'medium';
  }
  return 'long';
}
function wilson95(successes: number, total: number) {
  if (!total) return null;
  const z = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) / total) + (z * z) / (4 * total * total)) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}
function metricSummary(examples: SubjectPracticeSourceCorpusCalibrationExample[]) {
  const rejects = examples.filter((example) => example.expectedAction === 'reject');
  const allows = examples.filter((example) => example.expectedAction === 'allow');
  const excluded = examples.filter((example) => example.expectedAction === 'exclude');
  const falseNegativeCount = rejects.filter((example) => example.predictedAction === 'allow').length;
  const falsePositiveCount = allows.filter((example) => example.predictedAction === 'reject').length;
  const rejectAbstainCount = rejects.filter((example) => example.predictedAction === 'abstain').length;
  const allowAbstainCount = allows.filter((example) => example.predictedAction === 'abstain').length;
  return {
    rejectCount: rejects.length,
    allowCount: allows.length,
    excludedCount: excluded.length,
    abstainCount: examples.filter((example) => example.predictedAction === 'abstain').length,
    rejectAbstainCount,
    allowAbstainCount,
    rejectAbstainRate: rate(rejectAbstainCount, rejects.length),
    allowAbstainRate: rate(allowAbstainCount, allows.length),
    falseNegativeCount,
    falsePositiveCount,
    falseNegativeRate: rate(falseNegativeCount, rejects.length),
    falsePositiveRate: rate(falsePositiveCount, allows.length),
    falseNegativeWilson95: wilson95(falseNegativeCount, rejects.length),
    falsePositiveWilson95: wilson95(falsePositiveCount, allows.length)
  };
}
function expectedActionFor(label: TruthLabel): ExpectedAction {
  if (REJECT_LABELS.has(label)) return 'reject';
  if (ALLOW_LABELS.has(label)) return 'allow';
  return 'exclude';
}
function provenanceValid(example: SubjectPracticeSourceCorpusCalibrationExample) {
  if (example.truthLabel === 'ambiguous_excluded') return true;
  if (example.labelProvenance === 'formal_graph_proven') {
    return validSha256(example.formalGraphQualificationSha256)
      && validSha256(example.inventorySnapshotSha256)
      && (example.expectedAction === 'reject'
        || (example.sourceFamilyId !== example.candidateFamilyId
          && example.sourceLineageId !== example.candidateLineageId));
  }
  if (example.expectedAction === 'reject') {
    return ['mutation_proven', 'same_source_derived', 'human_gold'].includes(example.labelProvenance);
  }
  return ['independently_distinct', 'human_gold'].includes(example.labelProvenance)
    && example.sourceFamilyId !== example.candidateFamilyId
    && example.sourceLineageId !== example.candidateLineageId;
}

function connectedComponentSplitLeakage(examples: SubjectPracticeSourceCorpusCalibrationExample[]) {
  const parent = new Map<string, string>();
  const find = (value: string): string => {
    if (!parent.has(value)) parent.set(value, value);
    const current = parent.get(value)!;
    if (current === value) return value;
    const root = find(current);
    parent.set(value, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  for (const example of examples) {
    const nodes = [
      `family:${example.sourceFamilyId}`, `family:${example.candidateFamilyId}`,
      `lineage:${example.sourceLineageId}`, `lineage:${example.candidateLineageId}`
    ];
    for (const node of nodes.slice(1)) union(nodes[0], node);
  }
  const componentSplits = new Map<string, Set<string>>();
  for (const example of examples) {
    const root = find(`family:${example.sourceFamilyId}`);
    const splits = componentSplits.get(root) ?? new Set<string>();
    splits.add(example.split);
    componentSplits.set(root, splits);
  }
  return Array.from(componentSplits.entries()).filter(([, splits]) => splits.size > 1)
    .map(([componentId]) => componentId).sort();
}

export function scoreSubjectPracticeSourceCorpusCalibration(input: {
  datasetOrigin: 'fixture_only' | 'local_partial_inventory' | 'complete_inventory_labeled_calibration';
  examples: SubjectPracticeSourceCorpusCalibrationExample[];
  lengthPolicyQualification?: SubjectPracticeSourceCorpusLengthQualification | null;
  lengthPolicyExpectedBindings?: {
    inventoryManifestSha256: string;
    inventorySnapshotSha256: string;
    generatorVersionSetSha256: string;
    rendererVersionSetSha256: string;
  };
}) {
  const lengthPolicyQualified = Boolean(input.lengthPolicyExpectedBindings
    && subjectPracticeSourceCorpusLengthQualificationMatches({
      qualification: input.lengthPolicyQualification,
      expectedInventoryManifestSha256: input.lengthPolicyExpectedBindings.inventoryManifestSha256,
      expectedInventorySnapshotSha256: input.lengthPolicyExpectedBindings.inventorySnapshotSha256,
      expectedGeneratorVersionSetSha256: input.lengthPolicyExpectedBindings.generatorVersionSetSha256,
      expectedRendererVersionSetSha256: input.lengthPolicyExpectedBindings.rendererVersionSetSha256
    }));
  const invalidExampleIds: string[] = [];
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const example of input.examples) {
    if (seenIds.has(example.id)) duplicateIds.add(example.id);
    seenIds.add(example.id);
    const requiredStrings = [example.id, example.sourceQuestionId, example.candidateQuestionId,
      example.sourceFamilyId, example.candidateFamilyId, example.sourceLineageId,
      example.candidateLineageId, example.derivationId];
    if (requiredStrings.some((value) => !clean(value))
      || example.expectedAction !== expectedActionFor(example.truthLabel)
      || !SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS.includes(example.sourceLengthBucket)
      || !SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS.includes(example.targetLengthBucket)
      || (input.datasetOrigin === 'complete_inventory_labeled_calibration'
        && (!Number.isInteger(example.sourceNormalizedCharacterCount)
          || classifySubjectPracticeSourceLengthWithQualification({
            qualification: input.lengthPolicyQualification,
            subject: example.subject,
            language: example.language,
            field: example.sourceField,
            normalizedCharacterCount: Number(example.sourceNormalizedCharacterCount)
          }) !== example.sourceLengthBucket
          || !Number.isInteger(example.targetNormalizedCharacterCount)
          || classifySubjectPracticeSourceLengthWithQualification({
            qualification: input.lengthPolicyQualification,
            subject: example.subject,
            language: example.language,
            field: example.sourceField,
            normalizedCharacterCount: Number(example.targetNormalizedCharacterCount)
          }) !== example.targetLengthBucket))
      || !provenanceValid(example)
      || !example.mutationChain.length || !example.expectedInvariances.length
      || !validSha256(example.sourceContentSha256) || !validSha256(example.candidateContentSha256)) {
      invalidExampleIds.push(example.id);
    }
  }
  const splitLeakageComponentIds = connectedComponentSplitLeakage(input.examples);

  const cells: SubjectPracticeSourceCorpusCalibrationCell[] = [];
  for (const subject of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS) {
    for (const language of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES) {
      for (const sourceField of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS) {
        for (const targetLengthBucket of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS) {
          const examples = input.examples.filter((example) => example.subject === subject
            && example.language === language && example.sourceField === sourceField
            && example.targetLengthBucket === targetLengthBucket);
          cells.push({
            subject, language, sourceField, targetLengthBucket,
            ...metricSummary(examples)
          });
        }
      }
    }
  }

  const sourceLengthMarginals: SubjectPracticeSourceCorpusCalibrationSourceLengthMarginal[] = [];
  for (const subject of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS) {
    for (const language of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES) {
      for (const sourceField of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS) {
        for (const sourceLengthBucket of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS) {
          const examples = input.examples.filter((example) => example.subject === subject
            && example.language === language && example.sourceField === sourceField
            && example.sourceLengthBucket === sourceLengthBucket);
          sourceLengthMarginals.push({
            subject, language, sourceField, sourceLengthBucket,
            ...metricSummary(examples)
          });
        }
      }
    }
  }

  const reachableCellKeys = new Set(lengthPolicyQualified
    ? input.lengthPolicyQualification!.reachableCellKeys
    : cells.map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket)));
  const requiredCell = (cell: SubjectPracticeSourceCorpusCalibrationCell) =>
    reachableCellKeys.has(cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const missingCells = cells.filter((cell) => requiredCell(cell)
      && (cell.rejectCount === 0 || cell.allowCount === 0))
    .map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const thinCells = cells.filter((cell) => requiredCell(cell)
    && (cell.rejectCount < SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_COVERAGE_MINIMUM_PER_CLASS_PER_CELL
      || cell.allowCount < SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_COVERAGE_MINIMUM_PER_CLASS_PER_CELL))
    .map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const qualityThinCells = cells.filter((cell) => requiredCell(cell) && (cell.rejectCount
      < SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.minimumPerClassPerCell
    || cell.allowCount < SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.minimumPerClassPerCell))
    .map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const qualityErrorBoundCells = cells.filter((cell) => requiredCell(cell)
    && ((cell.falseNegativeWilson95?.upper ?? 1)
      > SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.maximumFalseNegativeWilson95Upper
    || (cell.falsePositiveWilson95?.upper ?? 1)
      > SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.maximumFalsePositiveWilson95Upper))
    .map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const qualityAbstainCells = cells.filter((cell) => requiredCell(cell)
    && ((cell.rejectAbstainRate ?? 1)
      > SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.maximumRejectAbstainRate
    || (cell.allowAbstainRate ?? 1)
      > SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS.maximumAllowAbstainRate))
    .map((cell) => cellKey(cell.subject, cell.language, cell.sourceField, cell.targetLengthBucket));
  const coveredLabels = new Set(input.examples.map((example) => example.truthLabel));
  const missingTruthLabels = SUBJECT_PRACTICE_SOURCE_CORPUS_TRUTH_LABELS.filter((label) => !coveredLabels.has(label));
  const coveredDerivations = new Set(input.examples.flatMap((example) => example.mutationChain));
  const missingDerivationKinds = SUBJECT_PRACTICE_SOURCE_CORPUS_DERIVATION_KINDS
    .filter((kind) => !coveredDerivations.has(kind));
  const dataReasonCodes: string[] = [];
  if (invalidExampleIds.length) dataReasonCodes.push('source_corpus_calibration_example_invalid');
  if (duplicateIds.size) dataReasonCodes.push('source_corpus_calibration_duplicate_id');
  if (splitLeakageComponentIds.length) dataReasonCodes.push('source_corpus_calibration_connected_lineage_split_leakage');
  if (missingCells.length) dataReasonCodes.push('source_corpus_calibration_axis_coverage_incomplete');
  if (thinCells.length) dataReasonCodes.push('source_corpus_calibration_coverage_sample_size_insufficient');
  if (missingTruthLabels.length) dataReasonCodes.push('source_corpus_calibration_truth_label_coverage_incomplete');
  if (missingDerivationKinds.length) dataReasonCodes.push('source_corpus_calibration_derivation_coverage_incomplete');
  if (input.datasetOrigin !== 'complete_inventory_labeled_calibration') {
    dataReasonCodes.push('source_corpus_calibration_complete_inventory_missing');
  }
  if (!lengthPolicyQualified) {
    dataReasonCodes.push('source_corpus_calibration_formal_language_field_length_policy_missing');
  }
  const qualityReasonCodes: string[] = [];
  if (qualityThinCells.length) qualityReasonCodes.push('source_corpus_calibration_quality_sample_size_insufficient');
  if (qualityErrorBoundCells.length) qualityReasonCodes.push('source_corpus_calibration_quality_wilson_bound_not_met');
  if (qualityAbstainCells.length) qualityReasonCodes.push('source_corpus_calibration_quality_abstain_rate_not_met');
  const thresholdFreezeReviewEligible = dataReasonCodes.length === 0;
  const calibrationQualityQualified = thresholdFreezeReviewEligible && qualityReasonCodes.length === 0;
  const datasetSnapshotSha256 = sha256([...input.examples].sort((left, right) => left.id.localeCompare(right.id)));
  const qualityThresholdsSha256 = sha256(SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS);
  const primaryReachableCellSetSha256 =
    subjectPracticeSourceCorpusCalibrationReachableCellSetSha256(Array.from(reachableCellKeys));
  let calibrationQualityQualification: SubjectPracticeSourceCorpusCalibrationQualityQualification | null = null;
  if (calibrationQualityQualified && input.lengthPolicyExpectedBindings) {
    const qualificationBody = {
      kind: 'subject_practice_source_corpus_calibration_quality_qualification' as const,
      qualificationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALIFICATION_VERSION,
      policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_POLICY_VERSION,
      datasetSnapshotSha256,
      inventoryManifestSha256: input.lengthPolicyExpectedBindings.inventoryManifestSha256,
      inventorySnapshotSha256: input.lengthPolicyExpectedBindings.inventorySnapshotSha256,
      generatorVersionSetSha256: input.lengthPolicyExpectedBindings.generatorVersionSetSha256,
      rendererVersionSetSha256: input.lengthPolicyExpectedBindings.rendererVersionSetSha256,
      lengthPolicyQualificationSha256: input.lengthPolicyQualification!.qualificationSha256,
      qualityThresholdsSha256,
      primaryReachableCellSetSha256
    } as const;
    calibrationQualityQualification = Object.freeze({
      ...qualificationBody,
      qualificationSha256: sha256(qualificationBody)
    });
    trustedCalibrationQualityQualifications.add(calibrationQualityQualification);
  }
  return {
    policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_POLICY_VERSION,
    datasetOrigin: input.datasetOrigin,
    status: !thresholdFreezeReviewEligible ? 'not_ready_for_threshold_freeze_review' as const
      : calibrationQualityQualified ? 'calibration_quality_qualified' as const
        : 'ready_for_threshold_freeze_review_quality_not_qualified' as const,
    thresholdFreezeReviewEligible,
    calibrationQualityQualified,
    datasetSnapshotSha256,
    qualityThresholdsSha256,
    primaryReachableCellSetSha256,
    calibrationQualityQualification,
    formalLanguageFieldLengthPolicyQualified: lengthPolicyQualified,
    reachableCalibrationCellCount: reachableCellKeys.size,
    unreachableCalibrationCellKeys: lengthPolicyQualified
      ? input.lengthPolicyQualification!.unreachableCellProofs.map((item) => item.cellKey)
      : [],
    dataReasonCodes,
    qualityReasonCodes,
    exampleCount: input.examples.length, cells, sourceLengthMarginals, missingCells, thinCells,
    qualityThinCells, qualityErrorBoundCells, qualityAbstainCells,
    missingTruthLabels, missingDerivationKinds, invalidExampleIds,
    duplicateIds: Array.from(duplicateIds).sort(), splitLeakageComponentIds,
    metricSemantics: {
      primaryQualityAxis: 'subject_language_source_field_target_length_bucket',
      sourceLengthRole: 'reported_marginal_only_not_used_to_satisfy_primary_quality_cells',
      falseNegativeRate: 'expected_reject_predicted_allow_per_subject_language_field_target_length_bucket',
      falsePositiveRate: 'expected_allow_predicted_reject_per_subject_language_field_target_length_bucket',
      coverageMinimumIsNotAQualityQualificationThreshold: true,
      qualityUsesWilson95UpperBounds: true,
      abstainIsNotAFalseNegativeButNeverAutoPublishes: true,
      ambiguousExamplesExcludedFromThresholdMetrics: true,
      aggregateOnlyDecisionForbidden: true,
      modelSelfLabelsCannotQualifyAsHumanGold: true
    },
    qualityThresholds: SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS,
    releaseImpact: 'none_calibration_evidence_only'
  };
}

export function subjectPracticeSourceCorpusCalibrationQualityQualificationMatches(input: {
  qualification: SubjectPracticeSourceCorpusCalibrationQualityQualification | null | undefined;
  expectedDatasetSnapshotSha256: string;
  expectedInventoryManifestSha256: string;
  expectedInventorySnapshotSha256: string;
  expectedGeneratorVersionSetSha256: string;
  expectedRendererVersionSetSha256: string;
  expectedLengthPolicyQualificationSha256: string;
  expectedPrimaryReachableCellSetSha256: string;
}) {
  const qualification = input.qualification;
  if (!qualification || !trustedCalibrationQualityQualifications.has(qualification)
    || !Object.isFrozen(qualification)) return false;
  const { qualificationSha256, ...qualificationBody } = qualification;
  return qualification.kind === 'subject_practice_source_corpus_calibration_quality_qualification'
    && qualification.qualificationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALIFICATION_VERSION
    && qualification.policyVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_POLICY_VERSION
    && qualification.datasetSnapshotSha256 === input.expectedDatasetSnapshotSha256
    && qualification.inventoryManifestSha256 === input.expectedInventoryManifestSha256
    && qualification.inventorySnapshotSha256 === input.expectedInventorySnapshotSha256
    && qualification.generatorVersionSetSha256 === input.expectedGeneratorVersionSetSha256
    && qualification.rendererVersionSetSha256 === input.expectedRendererVersionSetSha256
    && qualification.lengthPolicyQualificationSha256 === input.expectedLengthPolicyQualificationSha256
    && qualification.qualityThresholdsSha256
      === sha256(SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_QUALITY_THRESHOLDS)
    && qualification.primaryReachableCellSetSha256 === input.expectedPrimaryReachableCellSetSha256
    && validSha256(qualification.qualificationSha256)
    && qualification.qualificationSha256 === sha256(qualificationBody);
}
