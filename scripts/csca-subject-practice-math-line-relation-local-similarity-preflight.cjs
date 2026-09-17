#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildLocalCorpus } = require('./csca-subject-practice-source-corpus-scan.cjs');
const {
  normalizeSubjectPracticeSourceCorpusText,
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS,
  SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION,
  SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  generateSubjectPracticeMathLineRelationLocally,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-local-generator');
const {
  buildSubjectPracticeQuestionPlan,
  SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  evaluateSubjectPracticeCandidateOutputNovelty,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  resolveSubjectPracticeCandidateOutputNovelty,
  createSubjectPracticeCandidateNoveltyGraphDistinctProof,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-resolution-policy');
const {
  createSubjectPracticeFormalGraphDistinctOpaqueProof,
  SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-canonical-task-graph-policy');
const {
  solveSubjectPracticeMathLineRelation
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const {
  verifySubjectPracticeMathLineRelationWithIndependentOracle
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');
const {
  mathLinePlans,
  graphPair
} = require('./csca-subject-practice-local-db-partial-graph-shadow.cjs');

const SCOPES = [
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
];
const SEEDS_PER_SCOPE = 512;
const root = path.resolve(__dirname, '..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha256 = (relative) => sha256(fs.readFileSync(path.join(root, relative)));
const corpus = buildLocalCorpus(root);
const blueprint = {
  id: 91001, topicId: 92001, subject: 'math', difficulty: 'basic',
  questionType: 'single_choice', syllabusVersion: 'line-relation-shadow-v1'
};

function sourceCandidate(revision) {
  return {
    subject: 'math', topicId: 0, blueprintId: 0, sourceType: 'ai', designedDifficulty: 'basic',
    questionType: 'single_choice', prompt: revision.fields.prompt,
    options: revision.fields.options.map((option, index) => ({ id: String.fromCharCode(65 + index), text: option })),
    correctAnswer: revision.fields.answer, explanation: revision.fields.explanation,
    knowledgeTags: [], optionMetadata: [], syllabusVersion: 'local-partial-corpus-shadow-v1'
  };
}

function verifiedLineGraphForSourceRevision(revision) {
  if (revision.subject !== 'math' || revision.fields.options.length !== 4) return null;
  const candidate = sourceCandidate(revision);
  for (const questionPlan of mathLinePlans()) {
    const solver = solveSubjectPracticeMathLineRelation(candidate, { questionPlan });
    const oracle = verifySubjectPracticeMathLineRelationWithIndependentOracle(candidate, { questionPlan });
    if (solver.status !== 'verified' || oracle.status !== 'verified'
      || solver.scopeId !== oracle.scopeId || solver.selectedOptionId !== oracle.selectedOptionId) continue;
    const graphs = graphPair({ taskFamily: 'math_line_relation_direct', questionPlan, solver, oracle });
    if (graphs) return { ...graphs, scopeId: solver.scopeId };
  }
  return null;
}

const sourceLineGraphs = new Map(corpus.structuredRevisions.map((revision) => [
  revision.sourceQuestionRevisionId,
  verifiedLineGraphForSourceRevision(revision)
]).filter(([, graphs]) => Boolean(graphs)));

function ngrams(value, size = 5) {
  const result = new Set();
  for (let index = 0; index <= value.length - size; index += 1) result.add(value.slice(index, index + size));
  return result;
}

function containsContiguousMatch(left, right, length) {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < length) return false;
  for (let index = 0; index <= shorter.length - length; index += 1) {
    if (longer.includes(shorter.slice(index, index + length))) return true;
  }
  return false;
}

function buildSourceIndex(sourceTexts) {
  const sources = sourceTexts.map((raw, sourceIndex) => {
    const text = normalizeSubjectPracticeSourceCorpusText(raw);
    return { sourceIndex, text, grams: ngrams(text) };
  }).filter((source) => source.text.length >= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters);
  const gramToSources = new Map();
  sources.forEach((source, compiledIndex) => {
    for (const gram of source.grams) {
      const indexes = gramToSources.get(gram) ?? [];
      indexes.push(compiledIndex);
      gramToSources.set(gram, indexes);
    }
  });
  return { sources, gramToSources };
}

function fastThresholdEquivalentScan(targetFields, compiled) {
  let maxSimilarity = 0;
  let maxSourceCoverage = 0;
  let maxContiguousMatch = 0;
  let comparedPairCount = 0;
  const matchedSourceIndexes = new Set();
  const matchedExamples = [];
  for (const targetField of targetFields) {
    const target = normalizeSubjectPracticeSourceCorpusText(targetField.text);
    const targetGrams = ngrams(target);
    const candidates = new Set();
    for (const gram of targetGrams) for (const index of compiled.gramToSources.get(gram) ?? []) candidates.add(index);
    for (const index of candidates) {
      comparedPairCount += 1;
      const source = compiled.sources[index];
      let intersection = 0;
      for (const gram of source.grams) if (targetGrams.has(gram)) intersection += 1;
      const similarity = intersection / (targetGrams.size + source.grams.size - intersection);
      const sourceCoverage = intersection / source.grams.size;
      const adaptiveContiguousThreshold = Math.min(
        SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumContiguousMatchCharacters,
        Math.max(
          SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters,
          Math.ceil(source.text.length * SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumContiguousSourceRatio)
        )
      );
      const contiguousMatched = containsContiguousMatch(target, source.text, adaptiveContiguousThreshold);
      maxSimilarity = Math.max(maxSimilarity, similarity);
      maxSourceCoverage = Math.max(maxSourceCoverage, sourceCoverage);
      if (contiguousMatched) maxContiguousMatch = Math.max(maxContiguousMatch, adaptiveContiguousThreshold);
      const matched = similarity > SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumFiveGramSimilarity
        || sourceCoverage >= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.maximumSourceCoverage
        || contiguousMatched;
      if (matched) {
        matchedSourceIndexes.add(index);
        if (matchedExamples.length < 20) matchedExamples.push({
          targetField: targetField.field,
          targetExcerpt: targetField.text.slice(0, 180),
          sourceIndex: source.sourceIndex,
          sourceSha256: sha256(source.text),
          sourceExcerpt: source.text.slice(0, 180),
          similarity,
          sourceCoverage,
          adaptiveContiguousThreshold,
          contiguousMatched
        });
      }
    }
  }
  return {
    maxSimilarity,
    maxSourceCoverage,
    maxContiguousMatchThresholdLowerBound: maxContiguousMatch,
    matchedCount: matchedSourceIndexes.size,
    matchedExamples,
    comparedPairCount,
    skippedPairCount: targetFields.length * compiled.sources.length - comparedPairCount,
    skippedPairMaximumPossibleContiguousMatch: 4,
    thresholdDecisionEquivalentToFullV2Scan: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters > 4,
    prefilter: 'inverted_fivegram_index_then_exact_similarity_coverage_and_threshold_contiguous_check'
  };
}

const compiledCorpus = buildSourceIndex(corpus.entries);

function plan(exactLineRelationScope) {
  return buildSubjectPracticeQuestionPlan({
    subject: 'math', targetDifficulty: 'basic', topicTitle: 'line relation',
    productionCellId: 'line-relation-shadow-v1', taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope
  });
}

function provisionalLengthBucket(length) {
  if (length <= 0) return 'none';
  if (length <= 24) return 'short';
  if (length <= 79) return 'medium';
  return 'long';
}

function distribution(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const at = (rate) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rate) - 1)] : null;
  return {
    count: sorted.length,
    minimum: sorted[0] ?? null,
    median: at(0.5),
    p95: at(0.95),
    maximum: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null
  };
}

const scopeResults = [];
const failures = [];
for (const scope of SCOPES) {
  const questionPlan = plan(scope);
  const targetFields = [];
  const candidateHashes = [];
  const structuredCounts = { blocked: 0, ambiguous: 0, clear: 0 };
  const resolutionCounts = { blocked: 0, ambiguous: 0, clear: 0 };
  const graphResolution = {
    graphEligibleWeakRevisionCount: 0,
    sourceGraphSupportedRevisionCount: 0,
    opaqueGraphProofCreatedCount: 0,
    candidateWithOpaqueGraphProofCount: 0,
    resolvedRevisionCount: 0,
    fullyResolvedCandidateCount: 0,
    commonOnlyRevisionExcludedFromGraphOverrideCount: 0
  };
  const structuredReasonCounts = {};
  const structuredExamples = [];
  const structuredMatchDigests = [];
  const ambiguousRevisionCounts = [];
  const weakFragmentStats = new Map();
  const weakSignalDimensionCounts = {};
  for (let seed = 0; seed < SEEDS_PER_SCOPE; seed += 1) {
    const generated = generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
    if (generated.status !== 'generated_and_triple_verified' || !generated.candidate) {
      failures.push({ scope, seed, status: generated.status, reasonCodes: generated.reasonCodes });
      continue;
    }
    const candidate = generated.candidate;
    targetFields.push({ field: `${scope}.${seed}.candidate_prompt`, text: candidate.prompt });
    targetFields.push({ field: `${scope}.${seed}.candidate_options`, text: JSON.stringify(candidate.options.map((option) => option.text)) });
    const candidateContentSha256 = sha256(JSON.stringify(candidate));
    candidateHashes.push(candidateContentSha256);
    const canonicalTaskParameterFingerprint = generated.solverEvidence?.canonicalTask
      ? sha256(JSON.stringify({ scopeId: generated.scopeId, canonicalTask: generated.solverEvidence.canonicalTask }))
      : null;
    const novelty = evaluateSubjectPracticeCandidateOutputNovelty({
      candidate,
      candidateCanonicalTaskParameterFingerprint: canonicalTaskParameterFingerprint,
      sourceRevisions: corpus.structuredRevisions
    });
    structuredCounts[novelty.status] += 1;
    structuredMatchDigests.push(novelty.revisionMatchSetSha256);
    ambiguousRevisionCounts.push(novelty.ambiguousRevisionCount);
    for (const match of novelty.nonClearRevisionMatches.filter((item) => item.status === 'ambiguous')) {
      const targetLength = match.matchedFieldMask.includes('prompt') ? match.promptLengths.target
        : match.matchedFieldMask.includes('explanation') ? match.explanationLengths.target
          : Math.max(0, ...match.weakFragmentDescriptors.map((item) => item.normalizedLength));
      const sourceLength = match.matchedFieldMask.includes('prompt') ? match.promptLengths.source
        : match.matchedFieldMask.includes('explanation') ? match.explanationLengths.source
          : Math.max(0, ...match.weakFragmentDescriptors.map((item) => item.normalizedLength));
      const dimensionKey = [
        `${match.strongestLanguagePair.candidateLanguage}->${match.strongestLanguagePair.sourceLanguage}`,
        match.matchedFieldMask.slice().sort().join('+') || 'none',
        `target_${provisionalLengthBucket(targetLength)}`,
        `source_${provisionalLengthBucket(sourceLength)}`
      ].join(':');
      weakSignalDimensionCounts[dimensionKey] = (weakSignalDimensionCounts[dimensionKey] ?? 0) + 1;
      for (const fragment of match.weakFragmentDescriptors) {
        const stats = weakFragmentStats.get(fragment.fragmentSha256) ?? {
          fragmentSha256: fragment.fragmentSha256,
          fragmentClass: fragment.fragmentClass,
          normalizedLength: fragment.normalizedLength,
          candidateHashes: new Set(),
          sourceRevisionIds: new Set(),
          lineageHashes: new Set(),
          documentIdentityHashes: new Set()
        };
        stats.candidateHashes.add(candidateContentSha256);
        stats.sourceRevisionIds.add(match.sourceQuestionRevisionId);
        stats.lineageHashes.add(match.lineageHash);
        stats.documentIdentityHashes.add(match.sourceDocumentIdentityHash);
        weakFragmentStats.set(fragment.fragmentSha256, stats);
      }
    }
    const candidateGraphs = generated.solverEvidence && generated.oracleEvidence
      ? graphPair({
        taskFamily: 'math_line_relation_direct',
        questionPlan,
        solver: generated.solverEvidence,
        oracle: generated.oracleEvidence
      })
      : null;
    const graphProofs = [];
    for (const match of novelty.nonClearRevisionMatches.filter((item) => item.status === 'ambiguous')) {
      if (match.reasonCodes.includes('candidate_novelty_common_symbolic_fragment_only')) {
        graphResolution.commonOnlyRevisionExcludedFromGraphOverrideCount += 1;
        continue;
      }
      if (!match.reasonCodes.includes('candidate_novelty_weak_same_revision_signal_requires_review')) continue;
      graphResolution.graphEligibleWeakRevisionCount += 1;
      const sourceGraphs = sourceLineGraphs.get(match.sourceQuestionRevisionId);
      if (!candidateGraphs || !sourceGraphs || sourceGraphs.scopeId !== generated.scopeId) continue;
      graphResolution.sourceGraphSupportedRevisionCount += 1;
      const formalGraphDistinctProof = createSubjectPracticeFormalGraphDistinctOpaqueProof({
        sourceTaskGraph: sourceGraphs.taskGraph,
        candidateTaskGraph: candidateGraphs.taskGraph,
        sourceSolutionGraph: sourceGraphs.solutionGraph,
        candidateSolutionGraph: candidateGraphs.solutionGraph,
        verifierVersion: 'math-line-relation-local-partial-graph-distinct-shadow-v1'
      });
      if (!formalGraphDistinctProof) continue;
      const proof = createSubjectPracticeCandidateNoveltyGraphDistinctProof({
        sourceQuestionRevisionId: match.sourceQuestionRevisionId,
        lineageHash: match.lineageHash,
        sourceRevisionMatchSha256: match.matchSha256,
        candidateContentSha256,
        corpusSnapshotSha256: corpus.snapshotSha256,
        formalGraphDistinctProof
      });
      if (proof) graphProofs.push(proof);
    }
    if (graphProofs.length) graphResolution.candidateWithOpaqueGraphProofCount += 1;
    graphResolution.opaqueGraphProofCreatedCount += graphProofs.length;
    const resolution = resolveSubjectPracticeCandidateOutputNovelty({
      noveltyEvidence: novelty,
      candidateContentSha256,
      corpusSnapshotSha256: corpus.snapshotSha256,
      proofs: graphProofs
    });
    graphResolution.resolvedRevisionCount += resolution.resolvedRevisionCount;
    if (resolution.status === 'clear') graphResolution.fullyResolvedCandidateCount += 1;
    resolutionCounts[resolution.status] += 1;
    for (const reason of novelty.reasonCodes) structuredReasonCounts[reason] = (structuredReasonCounts[reason] ?? 0) + 1;
    if (novelty.status !== 'clear' && structuredExamples.length < 20) structuredExamples.push({
      seed,
      status: novelty.status,
      reasonCodes: novelty.reasonCodes,
      strongestSourceRevisionId: novelty.strongestSourceRevisionMatch?.sourceQuestionRevisionId ?? null,
      strongestLineageHash: novelty.strongestSourceRevisionMatch?.lineageHash ?? null,
      matchedFieldMask: novelty.strongestSourceRevisionMatch?.matchedFieldMask ?? [],
      strongestSignalScore: novelty.strongestSourceRevisionMatch?.strongestSignalScore ?? 0,
      revisionMatchSetSha256: novelty.revisionMatchSetSha256,
      sourceTextOrIdentityExposedToRepair: novelty.repairFeedbackMayExposeSourceIdentityOrText
    });
  }
  const metrics = fastThresholdEquivalentScan(targetFields, compiledCorpus);
  const weakFragmentDocumentFrequency = Array.from(weakFragmentStats.values()).map((item) => ({
    fragmentSha256: item.fragmentSha256,
    fragmentClass: item.fragmentClass,
    normalizedLength: item.normalizedLength,
    candidateCount: item.candidateHashes.size,
    sourceRevisionCount: item.sourceRevisionIds.size,
    independentLineageCount: item.lineageHashes.size,
    independentDocumentCount: item.documentIdentityHashes.size
  })).sort((left, right) => right.candidateCount - left.candidateCount
    || right.independentDocumentCount - left.independentDocumentCount
    || left.fragmentSha256.localeCompare(right.fragmentSha256));
  scopeResults.push({
    scope,
    attemptedCandidates: SEEDS_PER_SCOPE,
    generatedCandidates: candidateHashes.length,
    targetFieldCount: targetFields.length,
    uniqueCandidateHashes: new Set(candidateHashes).size,
    metrics,
    legacyFlatFieldMatchFree: metrics.matchedCount === 0,
    lineageAwareCandidateStatusCounts: structuredCounts,
    weakSignalResolutionStatusCounts: resolutionCounts,
    opaqueGraphResolutionMetrics: graphResolution,
    ambiguousRevisionCountDistribution: distribution(ambiguousRevisionCounts),
    weakSignalDimensionCounts,
    weakFragmentDocumentFrequencyTop20: weakFragmentDocumentFrequency.slice(0, 20),
    weakFragmentDistinctCount: weakFragmentDocumentFrequency.length,
    lengthBucketBoundaryStatus: 'provisional_local_partial_shadow_not_formal',
    lineageAwareReasonCounts: structuredReasonCounts,
    lineageAwareExamples: structuredExamples,
    lineageAwareRevisionMatchSetSha256: sha256(JSON.stringify(structuredMatchDigests.slice().sort())),
    lineageAwareBlockFree: structuredCounts.blocked === 0
  });
}

const candidateStatusTotals = scopeResults.reduce((totals, item) => {
  totals.blocked += item.lineageAwareCandidateStatusCounts.blocked;
  totals.ambiguous += item.lineageAwareCandidateStatusCounts.ambiguous;
  totals.clear += item.lineageAwareCandidateStatusCounts.clear;
  return totals;
}, { blocked: 0, ambiguous: 0, clear: 0 });
const resolvedCandidateStatusTotals = scopeResults.reduce((totals, item) => {
  totals.blocked += item.weakSignalResolutionStatusCounts.blocked;
  totals.ambiguous += item.weakSignalResolutionStatusCounts.ambiguous;
  totals.clear += item.weakSignalResolutionStatusCounts.clear;
  return totals;
}, { blocked: 0, ambiguous: 0, clear: 0 });
const totalCandidateCount = SCOPES.length * SEEDS_PER_SCOPE;

const checks = {
  fixedDenominatorGenerated: failures.length === 0
    && scopeResults.every((item) => item.generatedCandidates === SEEDS_PER_SCOPE),
  allCandidateHashesUniqueWithinScope: scopeResults.every((item) => item.uniqueCandidateHashes === SEEDS_PER_SCOPE),
  localPartialCorpusHasEntries: corpus.entries.length > 0 && corpus.manifest.questionCount > 0,
  localPartialCorpusNeverClaimedComplete: corpus.manifest.coverageStatus === 'partial'
    && corpus.controlledInventoryManifest.coverageStatus === 'partial',
  legacyFlatFieldScanMatchFree: scopeResults.every((item) => item.legacyFlatFieldMatchFree),
  lineageAwareCandidateBlockFree: scopeResults.every((item) => item.lineageAwareBlockFree),
  lineageAwareCountsCoverFixedDenominator: scopeResults.every((item) =>
    Object.values(item.lineageAwareCandidateStatusCounts).reduce((sum, count) => sum + count, 0) === SEEDS_PER_SCOPE),
  weakSignalResolutionCountsCoverFixedDenominator: scopeResults.every((item) =>
    Object.values(item.weakSignalResolutionStatusCounts).reduce((sum, count) => sum + count, 0) === SEEDS_PER_SCOPE),
  optimizedScanPreservesV2ThresholdDecision: scopeResults.every((item) => item.metrics.thresholdDecisionEquivalentToFullV2Scan),
  noProviderDatabasePublicationOrAttestation: true
};
const report = {
  mode: 'subject_practice_math_line_relation_local_candidate_output_similarity_preflight',
  reportVersion: 'math-line-relation-local-candidate-output-similarity-preflight-v5',
  status: failures.length > 0 || !checks.lineageAwareCandidateBlockFree
    ? 'failed'
    : 'completed_nonqualifying_partial_corpus_shadow_preflight',
  evidenceClassification: 'candidate_output_local_partial_corpus_unsigned_preflight',
  formalReleaseEligible: false,
  formalReleaseReasonCodes: [
    'source_corpus_inventory_incomplete',
    'production_database_inventory_not_bound_in_this_preflight',
    'remote_synced_source_inventory_missing',
    'trusted_hmac_attestation_not_created',
    'threshold_calibration_not_frozen_for_formal_release',
    'shadow_ambiguous_results_not_formally_adjudicated'
  ],
  checks,
  candidateStatusTotals,
  resolvedCandidateStatusTotals,
  shadowAbstentionRate: candidateStatusTotals.ambiguous / totalCandidateCount,
  shadowClearRate: candidateStatusTotals.clear / totalCandidateCount,
  graphResolvedShadowAbstentionRate: resolvedCandidateStatusTotals.ambiguous / totalCandidateCount,
  graphResolvedShadowClearRate: resolvedCandidateStatusTotals.clear / totalCandidateCount,
  fixedDenominator: {
    scopes: SCOPES.length,
    seedsPerScope: SEEDS_PER_SCOPE,
    candidateCount: SCOPES.length * SEEDS_PER_SCOPE,
    targetFieldCount: SCOPES.length * SEEDS_PER_SCOPE * 2,
    localCorpusQuestionCount: corpus.manifest.questionCount,
    localCorpusScanFieldCount: corpus.manifest.scanFieldCount
  },
  corpus: {
    snapshotId: corpus.snapshotId,
    snapshotSha256: corpus.snapshotSha256,
    coverageStatus: corpus.manifest.coverageStatus,
    inventoryCoverageStatus: corpus.controlledInventoryManifest.coverageStatus,
    inventoryReasonCodes: corpus.controlledInventoryManifest.reasonCodes,
    sourceFileCount: corpus.manifest.inventory.length,
    subjectCounts: corpus.manifest.subjectCounts,
    languageCounts: corpus.manifest.languageCounts,
    structuredCorpusSchemaVersion: corpus.manifest.structuredCorpusSchemaVersion,
    structuredRevisionCount: corpus.structuredRevisions.length,
    structuredRevisionSetSha256: corpus.manifest.structuredRevisionSetSha256,
    sourceLineGraphVerifiedRevisionCount: sourceLineGraphs.size
  },
  scopeResults,
  failures: failures.slice(0, 100),
  failureCount: failures.length,
  versions: {
    questionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
    generatorVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION,
    scannerPolicyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_SCAN_POLICY_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    matchingAlgorithmVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_MATCHING_ALGORITHM_VERSION,
    thresholdVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLD_VERSION,
    corpusBuilderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    candidateOutputNoveltyPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
    candidateNoveltyResolutionPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_RESOLUTION_POLICY_VERSION,
    canonicalTaskGraphPolicyVersion: SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
  },
  sourceBindings: {
    generatorSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-local-generator.ts'),
    questionPlanPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-question-plan-policy.ts'),
    scannerPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-source-corpus-scan-policy.ts'),
    noveltyPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy.ts'),
    noveltyResolutionPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-candidate-output-novelty-resolution-policy.ts'),
    canonicalTaskGraphPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-canonical-task-graph-policy.ts'),
    partialGraphBuilderSha256: fileSha256('scripts/csca-subject-practice-local-db-partial-graph-shadow.cjs'),
    preflightSha256: fileSha256('scripts/csca-subject-practice-math-line-relation-local-similarity-preflight.cjs')
  },
  hmacSecretConfigured: String(process.env.CSCA_SOURCE_CORPUS_SCANNER_HMAC_SECRET ?? '').trim().length >= 32,
  providerImpact: 'none_no_provider_call',
  estimatedCostUsd: 0,
  databaseImpact: 'none_local_files_only',
  publicationImpact: 'none'
};

if (require.main === module) {
  const output = process.argv.includes('--compact') ? {
    mode: report.mode,
    reportVersion: report.reportVersion,
    status: report.status,
    formalReleaseEligible: report.formalReleaseEligible,
    candidateStatusTotals: report.candidateStatusTotals,
    resolvedCandidateStatusTotals: report.resolvedCandidateStatusTotals,
    shadowAbstentionRate: report.shadowAbstentionRate,
    shadowClearRate: report.shadowClearRate,
    graphResolvedShadowAbstentionRate: report.graphResolvedShadowAbstentionRate,
    graphResolvedShadowClearRate: report.graphResolvedShadowClearRate,
    fixedDenominator: report.fixedDenominator,
    sourceLineGraphVerifiedRevisionCount: report.corpus.sourceLineGraphVerifiedRevisionCount,
    scopeResults: report.scopeResults.map((item) => ({
      scope: item.scope,
      lineageAwareCandidateStatusCounts: item.lineageAwareCandidateStatusCounts,
      weakSignalResolutionStatusCounts: item.weakSignalResolutionStatusCounts,
      opaqueGraphResolutionMetrics: item.opaqueGraphResolutionMetrics,
      ambiguousRevisionCountDistribution: item.ambiguousRevisionCountDistribution
    })),
    versions: report.versions,
    hmacSecretConfigured: report.hmacSecretConfigured,
    providerImpact: report.providerImpact,
    databaseImpact: report.databaseImpact,
    publicationImpact: report.publicationImpact
  } : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
if (report.status === 'failed') process.exitCode = 1;
module.exports = { report };
