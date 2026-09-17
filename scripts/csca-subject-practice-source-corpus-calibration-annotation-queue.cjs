#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');
const {
  normalizeSubjectPracticeSourceCorpusText,
  scanSubjectPracticeContentAgainstSourceCorpus
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  subjectPracticeSourceCorpusStructureShadowMatch
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-structure-shadow-policy');
const {
  classifySubjectPracticeSourceCorpusCalibrationLength
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-calibration-policy');
const { loadQuestions } = require('./csca-subject-practice-source-corpus-calibration-bootstrap.cjs');

const MODE = 'subject_practice_source_corpus_calibration_annotation_queue_v4';
const DEFAULT_PER_BUCKET_PER_AXIS = 20;
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function workspaceOutputPath(value, workspaceRoot = process.cwd()) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('source_corpus_annotation_queue_output_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('source_corpus_annotation_queue_output_must_be_json');
  if (existsSync(target)) throw new Error('source_corpus_annotation_queue_refuses_to_overwrite');
  return target;
}

function overlap(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function bucketFor(input) {
  if (input.lexical.matchedCount > 0 || input.structure.matched) return 'cross_family_duplicate_review';
  if (input.sharedTopicCodes.length || (input.source.questionForm
    && input.source.questionForm === input.candidate.questionForm)) return 'same_archetype_allowed_review';
  if (input.lexical.maxSimilarity <= 0.25 && input.lexical.maxSourceCoverage <= 0.35) {
    return 'distinct_review';
  }
  return 'ambiguous_review';
}

function pairRecord(source, candidate, sourceField) {
  const sourceText = source.fields[sourceField];
  const candidateText = candidate.fields[sourceField];
  const lexical = scanSubjectPracticeContentAgainstSourceCorpus({
    targetFields: [{ field: sourceField, text: candidateText }], sourceTexts: [sourceText]
  });
  const structure = subjectPracticeSourceCorpusStructureShadowMatch({ sourceField, sourceText, candidateText });
  const sharedTopicCodes = overlap(source.topicCodes, candidate.topicCodes);
  const reviewBucket = bucketFor({ source, candidate, lexical, structure, sharedTopicCodes });
  const sourceNormalizedCharacterCount = normalizeSubjectPracticeSourceCorpusText(sourceText).length;
  const targetNormalizedCharacterCount = normalizeSubjectPracticeSourceCorpusText(candidateText).length;
  const sourceLengthBucket = classifySubjectPracticeSourceCorpusCalibrationLength(sourceNormalizedCharacterCount);
  const targetLengthBucket = classifySubjectPracticeSourceCorpusCalibrationLength(targetNormalizedCharacterCount);
  return {
    pairId: sha256(`${source.sourceQuestionId}:${candidate.sourceQuestionId}:${sourceField}`).slice(0, 32),
    subject: source.subject, language: source.language, sourceField,
    sourceLengthBucket, sourceNormalizedCharacterCount,
    targetLengthBucket, targetNormalizedCharacterCount, reviewBucket,
    labelStatus: 'needs_human_gold', proposedTruthLabel: reviewBucket === 'cross_family_duplicate_review'
      ? 'duplicate_class_needs_review'
      : reviewBucket === 'same_archetype_allowed_review'
        ? 'same_archetype_allowed_needs_review'
        : reviewBucket === 'distinct_review' ? 'distinct_needs_review' : 'ambiguous_excluded',
    excludedFromThresholdFreeze: true,
    sourceQuestionId: source.sourceQuestionId, candidateQuestionId: candidate.sourceQuestionId,
    sourceFamilyId: source.sourceFamilyId, candidateFamilyId: candidate.sourceFamilyId,
    sourceLineageId: source.sourceLineageId, candidateLineageId: candidate.sourceLineageId,
    sourceDocumentId: source.sourceDocumentId, candidateDocumentId: candidate.sourceDocumentId,
    sourceSplit: source.split, candidateSplit: candidate.split,
    connectedComponentSplitStatus: source.split === candidate.split ? 'currently_same' : 'must_reassign_after_label',
    splitConstraint: 'all_connected_source_and_candidate_family_lineages_must_share_one_split',
    topicCodes: { source: source.topicCodes, candidate: candidate.topicCodes, shared: sharedTopicCodes },
    questionForm: { source: source.questionForm || null, candidate: candidate.questionForm || null },
    difficulty: { source: source.difficulty || null, candidate: candidate.difficulty || null },
    languageRelation: 'same_language', fieldRelation: 'same_field',
    sourceText, candidateText,
    sourceContentSha256: sha256(sourceText), candidateContentSha256: sha256(candidateText),
    lexicalMetrics: lexical,
    structureShadow: {
      policyVersion: structure.policyVersion, matched: structure.matched,
      matchedSignals: structure.matchedSignals, mode: structure.mode
    },
    reviewerFields: {
      truthLabel: null,
      productDecision: null,
      confidence: null,
      rationale: null,
      reviewerId: null,
      reviewedAt: null
    }
  };
}

function buildAnnotationQueue(input = {}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const perBucketPerAxis = Number.isInteger(input.perBucketPerAxis) && input.perBucketPerAxis > 0
    ? input.perBucketPerAxis : DEFAULT_PER_BUCKET_PER_AXIS;
  const questions = loadQuestions(workspaceRoot);
  const axes = new Map();
  for (const question of questions) {
    for (const [sourceField, value] of Object.entries(question.fields)) {
      if (!text(value) || normalizeSubjectPracticeSourceCorpusText(value).length < 12) continue;
      const key = `${question.subject}:${question.language}:${sourceField}`;
      const list = axes.get(key) ?? [];
      list.push(question);
      axes.set(key, list);
    }
  }
  const buckets = ['cross_family_duplicate_review', 'same_archetype_allowed_review', 'distinct_review', 'ambiguous_review'];
  const lengthBuckets = ['short', 'medium', 'long'];
  const pairs = [];
  for (const [axis, records] of axes) {
    const selected = Object.fromEntries(lengthBuckets.flatMap((targetLengthBucket) => buckets
      .map((bucket) => [`${targetLengthBucket}:${bucket}`, []])));
    const sourceField = axis.split(':')[2];
    outer: for (let offset = 1; offset < records.length; offset += 1) {
      for (let index = 0; index < records.length; index += 1) {
        const source = records[index];
        const candidate = records[(index + offset) % records.length];
        if (source.sourceFamilyId === candidate.sourceFamilyId) continue;
        const pair = pairRecord(source, candidate, sourceField);
        const selectionKey = `${pair.targetLengthBucket}:${pair.reviewBucket}`;
        if (selected[selectionKey].length < perBucketPerAxis) selected[selectionKey].push(pair);
        if (Object.values(selected).every((items) => items.length >= perBucketPerAxis)) break outer;
      }
    }
    pairs.push(...Object.values(selected).flat());
  }
  const bucketCounts = {};
  const axisCounts = {};
  for (const pair of pairs) {
    bucketCounts[pair.reviewBucket] = (bucketCounts[pair.reviewBucket] ?? 0) + 1;
    const key = `${pair.subject}:${pair.language}:${pair.sourceField}:${pair.targetLengthBucket}`;
    axisCounts[key] = (axisCounts[key] ?? 0) + 1;
  }
  const validationChecks = {
    pairIdsUnique: new Set(pairs.map((pair) => pair.pairId)).size === pairs.length,
    allPairsNeedHumanGold: pairs.length > 0 && pairs.every((pair) => pair.labelStatus === 'needs_human_gold'),
    allPairsExcludedFromThresholdFreeze: pairs.every((pair) => pair.excludedFromThresholdFreeze),
    noReviewerDecisionPrepopulated: pairs.every((pair) => Object.values(pair.reviewerFields).every((value) => value === null)),
    sourceAndCandidateFamiliesDistinct: pairs.every((pair) => pair.sourceFamilyId !== pair.candidateFamilyId),
    sourceAndCandidateContentBound: pairs.every((pair) => /^[a-f0-9]{64}$/.test(pair.sourceContentSha256)
      && /^[a-f0-9]{64}$/.test(pair.candidateContentSha256))
  };
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-calibration-annotation-queue-v4',
    mode: MODE,
    status: Object.values(validationChecks).every(Boolean)
      ? 'needs_human_gold_nonqualifying' : 'invalid_annotation_queue',
    sourceQuestionCount: questions.length, perBucketPerAxis, pairCount: pairs.length,
    bucketCounts, axisCounts, validationChecks, pairs,
    qualificationBoundary: {
      thresholdFreezeEligible: false,
      reason: 'queue_labels_are_proposals_only_until_independent_human_gold_is_locked'
    },
    providerImpact: 'none_no_provider_call', dbImpact: 'none_local_files_only',
    productionImpact: 'none_annotation_queue_only'
  };
  return { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
}

function summaryFor(queue) {
  return {
    mode: queue.mode, status: queue.status, sourceQuestionCount: queue.sourceQuestionCount,
    pairCount: queue.pairCount, bucketCounts: queue.bucketCounts, axisCounts: queue.axisCounts,
    validationChecks: queue.validationChecks,
    payloadSha256: queue.payloadSha256,
    qualificationBoundary: queue.qualificationBoundary,
    providerImpact: queue.providerImpact, dbImpact: queue.dbImpact, productionImpact: queue.productionImpact
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  const perBucketPerAxis = Number.parseInt(text(args['per-bucket-per-axis']), 10);
  const queue = buildAnnotationQueue({ perBucketPerAxis });
  if (queue.status !== 'needs_human_gold_nonqualifying') throw new Error('source_corpus_annotation_queue_validation_failed');
  const summary = summaryFor(queue);
  if (args.out) {
    const outputPath = workspaceOutputPath(args.out);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(queue, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    summary.outputPath = outputPath;
  }
  return summary;
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { argsFrom, workspaceOutputPath, buildAnnotationQueue, summaryFor };
