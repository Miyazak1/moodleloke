#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES,
  SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS,
  SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS,
  SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS,
  scoreSubjectPracticeSourceCorpusCalibration,
  subjectPracticeSourceCorpusCalibrationQualityQualificationMatches
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-calibration-policy');
const {
  qualification: lengthPolicyQualification,
  completeManifest: lengthPolicyInventoryManifest,
  inventorySnapshotSha256: lengthPolicyInventorySnapshotSha256
} = require('./csca-subject-practice-source-corpus-length-policy-self-test.cjs');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const rejectLabels = ['exact_or_format_duplicate', 'near_duplicate_same_source', 'structural_duplicate'];
const rejectKinds = [
  'verbatim_copy', 'punctuation_spacing_or_latex_change', 'option_reordering',
  'entity_only_substitution', 'light_numeric_change', 'cross_field_splice',
  'short_source_in_long_text', 'same_source_translation', 'light_paraphrase',
  'formula_isomorphism', 'reasoning_graph_isomorphism', 'answer_position_change'
];
const allowLabels = ['same_archetype_allowed', 'distinct'];
const allowKinds = [
  'shared_syllabus_terms', 'shared_formula_different_task',
  'shared_question_type_distinct_values_and_context', 'unavoidable_standard_definition',
  'independently_distinct_question'
];
const normalizedLengthForBucket = (subject, language, sourceField, bucket) => {
  const boundary = lengthPolicyQualification.axisBoundaries.find((item) =>
    item.subject === subject && item.language === language && item.field === sourceField);
  if (!boundary) throw new Error('fixture_length_axis_missing');
  if (bucket === 'short') return boundary.shortMaximumNormalizedCharacters;
  if (bucket === 'medium') return boundary.shortMaximumNormalizedCharacters + 1;
  return boundary.mediumMaximumNormalizedCharacters + 1;
};

const examples = [];
let cellIndex = 0;
for (const subject of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SUBJECTS) {
  for (const language of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LANGUAGES) {
    for (const sourceField of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_SOURCE_FIELDS) {
      for (const sourceLengthBucket of SUBJECT_PRACTICE_SOURCE_CORPUS_CALIBRATION_LENGTH_BUCKETS) {
      const sourceFamilyId = `family-${cellIndex}`;
      const split = cellIndex % 2 ? 'test' : 'calibration';
      for (let sample = 0; sample < 20; sample += 1) {
        const rejectKind = rejectKinds[(cellIndex * 20 + sample) % rejectKinds.length];
        examples.push({
          id: `reject-${cellIndex}-${sample}`, subject, language, sourceField, sourceLengthBucket,
          sourceNormalizedCharacterCount:
            normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
          targetLengthBucket: sourceLengthBucket,
          targetNormalizedCharacterCount:
            normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
          truthLabel: rejectLabels[sample % rejectLabels.length], expectedAction: 'reject', predictedAction: 'reject',
          labelProvenance: sample % 2 ? 'same_source_derived' : 'mutation_proven',
          sourceQuestionId: `source-${cellIndex}`, candidateQuestionId: `derived-${cellIndex}-${sample}`,
          sourceFamilyId, candidateFamilyId: sourceFamilyId,
          sourceLineageId: `lineage-${cellIndex}`, candidateLineageId: `lineage-${cellIndex}`,
          derivationId: `derive-reject-${cellIndex}-${sample}`,
          mutationChain: [rejectKind],
          languageRelation: rejectKind === 'same_source_translation' ? 'same_source_translation' : 'same_language',
          fieldRelation: rejectKind === 'cross_field_splice' ? 'cross_field' : 'same_field',
          expectedInvariances: ['source_lineage', 'tested_duplicate_property'], split,
          sourceContentSha256: sha(`source-${cellIndex}`),
          candidateContentSha256: sha(`reject-candidate-${cellIndex}-${sample}`)
        });
        const allowKind = allowKinds[(cellIndex * 20 + sample) % allowKinds.length];
        examples.push({
          id: `allow-${cellIndex}-${sample}`, subject, language, sourceField, sourceLengthBucket,
          sourceNormalizedCharacterCount:
            normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
          targetLengthBucket: sourceLengthBucket,
          targetNormalizedCharacterCount:
            normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
          truthLabel: allowLabels[sample % allowLabels.length], expectedAction: 'allow', predictedAction: 'allow',
          labelProvenance: sample % 3 ? 'independently_distinct' : 'human_gold',
          sourceQuestionId: `source-${cellIndex}`, candidateQuestionId: `independent-${cellIndex}-${sample}`,
          sourceFamilyId, candidateFamilyId: `distinct-family-${cellIndex}-${sample}`,
          sourceLineageId: `lineage-${cellIndex}`,
          candidateLineageId: `independent-lineage-${cellIndex}-${sample}`,
          derivationId: `derive-allow-${cellIndex}-${sample}`, mutationChain: [allowKind],
          languageRelation: 'same_language', fieldRelation: 'same_field',
          expectedInvariances: ['same_archetype_may_be_allowed', 'different_source_lineage'], split,
          sourceContentSha256: sha(`source-${cellIndex}`),
          candidateContentSha256: sha(`allow-candidate-${cellIndex}-${sample}`)
        });
      }
      examples.push({
        id: `ambiguous-${cellIndex}`, subject, language, sourceField, sourceLengthBucket,
        sourceNormalizedCharacterCount:
          normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
        targetLengthBucket: sourceLengthBucket,
        targetNormalizedCharacterCount:
          normalizedLengthForBucket(subject, language, sourceField, sourceLengthBucket),
        truthLabel: 'ambiguous_excluded', expectedAction: 'exclude', predictedAction: 'abstain',
        labelProvenance: 'human_gold', sourceQuestionId: `source-${cellIndex}`,
        candidateQuestionId: `ambiguous-candidate-${cellIndex}`, sourceFamilyId,
        candidateFamilyId: `unknown-family-${cellIndex}`, sourceLineageId: `lineage-${cellIndex}`,
        candidateLineageId: `unknown-lineage-${cellIndex}`,
        derivationId: `derive-ambiguous-${cellIndex}`,
        mutationChain: ['unresolved_historical_pair', 'short_common_field_value'],
        languageRelation: 'cross_source_language_pair', fieldRelation: 'same_field',
        expectedInvariances: ['excluded_from_threshold_metrics'], split,
        sourceContentSha256: sha(`source-${cellIndex}`), candidateContentSha256: sha(`ambiguous-${cellIndex}`)
      });
      cellIndex += 1;
      }
    }
  }
}

const fixtureScore = scoreSubjectPracticeSourceCorpusCalibration({ datasetOrigin: 'fixture_only', examples });
const lengthPolicyExpectedBindings = {
  inventoryManifestSha256: lengthPolicyInventoryManifest.manifestSha256,
  inventorySnapshotSha256: lengthPolicyInventorySnapshotSha256,
  generatorVersionSetSha256: lengthPolicyQualification.generatorVersionSetSha256,
  rendererVersionSetSha256: lengthPolicyQualification.rendererVersionSetSha256
};
const completeInput = (completeExamples) => ({
  datasetOrigin: 'complete_inventory_labeled_calibration',
  examples: completeExamples,
  lengthPolicyQualification,
  lengthPolicyExpectedBindings
});
const completeScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(examples));
const reachableCellKeys = new Set(lengthPolicyQualification.reachableCellKeys);
const qualityExamples = examples
  .filter((example) => reachableCellKeys.has(
    `${example.subject}:${example.language}:${example.sourceField}:${example.targetLengthBucket}`
  ))
  .flatMap((example) => example.expectedAction === 'exclude' ? [example]
    : Array.from({ length: 10 }, (_, copyIndex) => ({
      ...example,
      id: `${example.id}-quality-${copyIndex}`,
      candidateQuestionId: `${example.candidateQuestionId}-quality-${copyIndex}`,
      derivationId: `${example.derivationId}-quality-${copyIndex}`
    })));
const qualityScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(qualityExamples));
const completeWithoutLengthPolicy = scoreSubjectPracticeSourceCorpusCalibration({
  datasetOrigin: 'complete_inventory_labeled_calibration', examples
});
const thinScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(
  examples.filter((example) => example.id.endsWith('-0') || example.id.startsWith('ambiguous-'))
));
const falseNegativeExamples = examples.map((example, index) => index === 0
  ? { ...example, predictedAction: 'allow' } : example);
const falseNegativeScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(falseNegativeExamples));
const splitLeakageExamples = examples.map((example, index) => index === 0
  ? { ...example, split: example.split === 'test' ? 'calibration' : 'test' } : example);
const splitLeakageScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(splitLeakageExamples));
const allAbstainScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(
  examples.map((example) => example.expectedAction === 'exclude'
    ? example : { ...example, predictedAction: 'abstain' })
));
const firstAllowed = examples.find((example) => example.expectedAction === 'allow');
const unreliableNegative = { ...firstAllowed, id: 'unreliable-negative', candidateFamilyId: firstAllowed.sourceFamilyId };
const unreliableNegativeScore = scoreSubjectPracticeSourceCorpusCalibration(
  completeInput([...examples, unreliableNegative])
);
const sourceMarginalProbeExamples = examples.map((example, index) => index === 0
  ? {
    ...example,
    sourceLengthBucket: 'long',
    sourceNormalizedCharacterCount: normalizedLengthForBucket(
      example.subject, example.language, example.sourceField, 'long'
    )
  } : example);
const sourceMarginalProbeScore = scoreSubjectPracticeSourceCorpusCalibration(
  completeInput(sourceMarginalProbeExamples)
);
const targetBucketMismatchScore = scoreSubjectPracticeSourceCorpusCalibration(completeInput(
  examples.map((example, index) => index === 0 ? { ...example, targetLengthBucket: 'long' } : example)
));

const primaryShortCell = completeScore.cells.find((cell) => cell.subject === 'math'
  && cell.language === 'en' && cell.sourceField === 'prompt' && cell.targetLengthBucket === 'short');
const probePrimaryShortCell = sourceMarginalProbeScore.cells.find((cell) => cell.subject === 'math'
  && cell.language === 'en' && cell.sourceField === 'prompt' && cell.targetLengthBucket === 'short');
const sourceShortMarginal = completeScore.sourceLengthMarginals.find((cell) => cell.subject === 'math'
  && cell.language === 'en' && cell.sourceField === 'prompt' && cell.sourceLengthBucket === 'short');
const probeSourceShortMarginal = sourceMarginalProbeScore.sourceLengthMarginals.find((cell) => cell.subject === 'math'
  && cell.language === 'en' && cell.sourceField === 'prompt' && cell.sourceLengthBucket === 'short');
const qualityQualification = qualityScore.calibrationQualityQualification;
const qualificationMatchInput = {
  qualification: qualityQualification,
  expectedDatasetSnapshotSha256: qualityScore.datasetSnapshotSha256,
  expectedInventoryManifestSha256: lengthPolicyExpectedBindings.inventoryManifestSha256,
  expectedInventorySnapshotSha256: lengthPolicyExpectedBindings.inventorySnapshotSha256,
  expectedGeneratorVersionSetSha256: lengthPolicyExpectedBindings.generatorVersionSetSha256,
  expectedRendererVersionSetSha256: lengthPolicyExpectedBindings.rendererVersionSetSha256,
  expectedLengthPolicyQualificationSha256: lengthPolicyQualification.qualificationSha256,
  expectedPrimaryReachableCellSetSha256: qualityScore.primaryReachableCellSetSha256
};

const checks = {
  allNinetyAxesReported: fixtureScore.cells.length === 90 && fixtureScore.missingCells.length === 0,
  gradedTruthAndAllDerivationsCovered: fixtureScore.missingTruthLabels.length === 0
    && fixtureScore.missingDerivationKinds.length === 0,
  fixtureCannotReachFreezeReview: !fixtureScore.thresholdFreezeReviewEligible
    && fixtureScore.dataReasonCodes.includes('source_corpus_calibration_complete_inventory_missing'),
  coverageAndQualityQualificationSeparated: completeScore.thresholdFreezeReviewEligible
    && completeScore.formalLanguageFieldLengthPolicyQualified
    && !completeScore.calibrationQualityQualified,
  completeInventoryCannotBypassLengthPolicy: !completeWithoutLengthPolicy.thresholdFreezeReviewEligible
    && completeWithoutLengthPolicy.dataReasonCodes
      .includes('source_corpus_calibration_formal_language_field_length_policy_missing'),
  unreachableCellsExcludedOnlyByOpaqueQualification:
    completeScore.reachableCalibrationCellCount === lengthPolicyQualification.reachableCellKeys.length
    && completeScore.unreachableCalibrationCellKeys.length
      === lengthPolicyQualification.unreachableCellProofs.length,
  perCellCoverageMinimumEnforced: thinScore.dataReasonCodes.includes('source_corpus_calibration_coverage_sample_size_insufficient'),
  perCellFalseNegativeAndConfidenceVisible: falseNegativeScore.cells.some((cell) => cell.falseNegativeCount === 1
    && cell.falseNegativeRate === 0.05 && cell.falseNegativeWilson95.upper > cell.falseNegativeRate),
  connectedLineageSplitEnforced: splitLeakageScore.dataReasonCodes.includes('source_corpus_calibration_connected_lineage_split_leakage'),
  unreliableNegativeRejected: unreliableNegativeScore.dataReasonCodes.includes('source_corpus_calibration_example_invalid'),
  targetLengthIsPrimaryAndSourceLengthIsMarginal: primaryShortCell.rejectCount === probePrimaryShortCell.rejectCount
    && sourceShortMarginal.rejectCount === probeSourceShortMarginal.rejectCount + 1
    && completeScore.metricSemantics.primaryQualityAxis
      === 'subject_language_source_field_target_length_bucket',
  declaredTargetBucketMustMatchNormalizedLength: targetBucketMismatchScore.dataReasonCodes
    .includes('source_corpus_calibration_example_invalid'),
  qualityQualifiedDatasetMintsOpaqueQualification: qualityScore.calibrationQualityQualified
    && subjectPracticeSourceCorpusCalibrationQualityQualificationMatches(qualificationMatchInput),
  underpoweredDatasetCannotMintQualification: completeScore.calibrationQualityQualification === null,
  copiedQualificationRejected: !subjectPracticeSourceCorpusCalibrationQualityQualificationMatches({
    ...qualificationMatchInput,
    qualification: qualityQualification ? { ...qualityQualification } : null
  }),
  datasetBindingMismatchRejected: !subjectPracticeSourceCorpusCalibrationQualityQualificationMatches({
    ...qualificationMatchInput,
    expectedDatasetSnapshotSha256: sha('different-calibration-dataset')
  }),
  allAbstainCannotQualifyQuality: !allAbstainScore.calibrationQualityQualified
    && allAbstainScore.qualityReasonCodes.includes('source_corpus_calibration_quality_abstain_rate_not_met'),
  ambiguousExcludedAndAbstains: completeScore.cells.every((cell) => cell.excludedCount === 1 && cell.abstainCount === 1),
  aggregateOnlyDecisionForbidden: fixtureScore.metricSemantics.aggregateOnlyDecisionForbidden === true
};

const report = {
  mode: 'subject_practice_source_corpus_calibration_self_test',
  reportVersion: 'subject-practice-source-corpus-calibration-self-test-v9',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  axisCount: fixtureScore.cells.length,
  fixtureExampleCount: fixtureScore.exampleCount,
  fixtureThresholdFreezeReviewEligible: fixtureScore.thresholdFreezeReviewEligible,
  fixtureCalibrationQualityQualified: fixtureScore.calibrationQualityQualified,
  providerImpact: 'none_no_provider_call', dbImpact: 'none_fixture_only', productionImpact: 'none_no_gate_change'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = {
  report,
  qualityQualification,
  qualityScore,
  lengthPolicyExpectedBindings,
  lengthPolicyQualification
};
