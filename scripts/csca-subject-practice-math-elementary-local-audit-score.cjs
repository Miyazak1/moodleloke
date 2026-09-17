#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  AUDIT_PROTOCOL_VERSION,
  buildAuditBatch
} = require('./csca-subject-practice-math-elementary-local-audit-export.cjs');

const SCORE_POLICY_VERSION = 'math-elementary-local-blind-audit-score-v1';
const EXPECTED_SCOPES = [
  'math-basic-elementary-rotation-v1:logarithmic:domain',
  'math-basic-elementary-rotation-v1:exponential:range',
  'math-basic-elementary-rotation-v1:radical:monotonicity',
  'math-basic-elementary-rotation-v1:power:function_value'
];
const THRESHOLDS = {
  minimumTotal: 32,
  minimumPerScope: 8,
  minimumAnswerAgreementRate: 1,
  minimumSolvableRate: 1,
  minimumUniqueAnswerRate: 1,
  minimumSyllabusAlignedRate: 1,
  minimumLanguagePassRate: 0.95,
  minimumStrictQualifiedRate: 0.95
};

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function validateInputs({ manifest, blindReviewPacket, answerKey, reviewResponse }) {
  const failureCodes = [];
  if (manifest?.auditProtocolVersion !== AUDIT_PROTOCOL_VERSION
    || blindReviewPacket?.auditProtocolVersion !== AUDIT_PROTOCOL_VERSION
    || answerKey?.auditProtocolVersion !== AUDIT_PROTOCOL_VERSION
    || reviewResponse?.auditProtocolVersion !== AUDIT_PROTOCOL_VERSION) {
    failureCodes.push('audit_protocol_version_mismatch');
  }
  if (manifest?.blindPacketSha256 !== sha256(blindReviewPacket)) failureCodes.push('blind_packet_hash_mismatch');
  if (manifest?.answerKeySha256 !== sha256(answerKey)) failureCodes.push('answer_key_hash_mismatch');
  if (reviewResponse?.blindPacketSha256 !== manifest?.blindPacketSha256) failureCodes.push('review_response_blind_packet_binding_mismatch');
  const attestation = recordFrom(reviewResponse?.reviewerAttestation);
  if (!attestation || typeof attestation.reviewerId !== 'string' || !attestation.reviewerId.trim()) failureCodes.push('reviewer_identity_missing');
  if (attestation?.reviewedWithoutAnswerKey !== true) failureCodes.push('reviewer_blind_attestation_missing');
  if (typeof attestation?.lockedAt !== 'string' || !Number.isFinite(Date.parse(attestation.lockedAt))) failureCodes.push('review_lock_timestamp_missing_or_invalid');

  const questions = Array.isArray(blindReviewPacket?.questions) ? blindReviewPacket.questions : [];
  const answers = Array.isArray(answerKey?.answers) ? answerKey.answers : [];
  const reviews = Array.isArray(reviewResponse?.reviews) ? reviewResponse.reviews : [];
  const questionIds = questions.map((item) => item?.candidateId).filter(Boolean);
  const answerIds = answers.map((item) => item?.candidateId).filter(Boolean);
  const reviewIds = reviews.map((item) => item?.candidateId).filter(Boolean);
  if (questionIds.length !== manifest?.selectedAuditCount || new Set(questionIds).size !== questionIds.length) failureCodes.push('blind_packet_candidate_set_invalid');
  if (answerIds.length !== questionIds.length || new Set(answerIds).size !== answerIds.length) failureCodes.push('answer_key_candidate_set_invalid');
  if (reviewIds.length !== questionIds.length || new Set(reviewIds).size !== reviewIds.length) failureCodes.push('review_response_candidate_set_invalid');
  const expectedSet = [...questionIds].sort().join('|');
  const manifestCandidateIds = Array.isArray(manifest?.selectedCandidateIds) ? manifest.selectedCandidateIds : [];
  if ([...manifestCandidateIds].sort().join('|') !== expectedSet) failureCodes.push('manifest_candidate_set_mismatch');
  if ([...answerIds].sort().join('|') !== expectedSet) failureCodes.push('answer_key_candidate_set_mismatch');
  if ([...reviewIds].sort().join('|') !== expectedSet) failureCodes.push('review_response_candidate_set_mismatch');
  for (const question of questions) {
    if (!EXPECTED_SCOPES.includes(question?.scopeId)) failureCodes.push('blind_packet_scope_invalid');
    const semanticFingerprint = sha256({
      prompt: question?.prompt,
      optionTextsIgnoringPosition: Array.isArray(question?.options) ? question.options.map((option) => option?.text).sort() : []
    });
    if (question?.semanticFingerprint !== semanticFingerprint) failureCodes.push('blind_packet_semantic_fingerprint_mismatch');
  }
  for (const review of reviews) {
    if (!['A', 'B', 'C', 'D'].includes(review?.selectedOptionId)) failureCodes.push('review_selected_option_invalid');
    const question = questions.find((item) => item?.candidateId === review?.candidateId);
    if (question && !question.options.some((option) => option?.id === review?.selectedOptionId)) failureCodes.push('review_selected_option_not_present');
    if (typeof review?.isSolvable !== 'boolean') failureCodes.push('review_solvable_verdict_invalid');
    if (typeof review?.hasUniqueCorrectAnswer !== 'boolean') failureCodes.push('review_unique_answer_verdict_invalid');
    if (typeof review?.syllabusAligned !== 'boolean') failureCodes.push('review_syllabus_verdict_invalid');
    if (!['pass', 'minor_issue', 'fail'].includes(review?.languageQuality)) failureCodes.push('review_language_quality_invalid');
    if (typeof review?.notes !== 'string') failureCodes.push('review_notes_invalid');
  }
  for (const answer of answers) {
    if (!['A', 'B', 'C', 'D'].includes(answer?.correctAnswer)) failureCodes.push('answer_key_option_invalid');
  }
  return { valid: failureCodes.length === 0, failureCodes: [...new Set(failureCodes)], questions, answers, reviews };
}

function metricsFor(rows) {
  const total = rows.length;
  const answerAgreementCount = rows.filter((row) => row.answerAgrees).length;
  const solvableCount = rows.filter((row) => row.review.isSolvable).length;
  const uniqueAnswerCount = rows.filter((row) => row.review.hasUniqueCorrectAnswer).length;
  const syllabusAlignedCount = rows.filter((row) => row.review.syllabusAligned).length;
  const languagePassCount = rows.filter((row) => row.review.languageQuality === 'pass').length;
  const languageMinorIssueCount = rows.filter((row) => row.review.languageQuality === 'minor_issue').length;
  const strictQualifiedCount = rows.filter((row) => row.strictQualified).length;
  return {
    total,
    answerAgreementCount,
    answerAgreementRate: rate(answerAgreementCount, total),
    solvableCount,
    solvableRate: rate(solvableCount, total),
    uniqueAnswerCount,
    uniqueAnswerRate: rate(uniqueAnswerCount, total),
    syllabusAlignedCount,
    syllabusAlignedRate: rate(syllabusAlignedCount, total),
    languagePassCount,
    languagePassRate: rate(languagePassCount, total),
    languageMinorIssueCount,
    strictQualifiedCount,
    strictQualifiedRate: rate(strictQualifiedCount, total)
  };
}

function scoreAuditBatch({ manifest, blindReviewPacket, answerKey, reviewResponse }) {
  const validation = validateInputs({ manifest, blindReviewPacket, answerKey, reviewResponse });
  if (!validation.valid) {
    return {
      scorePolicyVersion: SCORE_POLICY_VERSION,
      status: 'invalid_audit_evidence',
      validEvidence: false,
      qualityGatePassed: false,
      failureCodes: validation.failureCodes,
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_no_database_connection',
      publicationImpact: 'none',
      releaseQualification: false
    };
  }
  const questionById = new Map(validation.questions.map((item) => [item.candidateId, item]));
  const answerById = new Map(validation.answers.map((item) => [item.candidateId, item]));
  const rows = validation.reviews.map((review) => {
    const question = questionById.get(review.candidateId);
    const answer = answerById.get(review.candidateId);
    const answerAgrees = review.selectedOptionId === answer.correctAnswer;
    return {
      candidateId: review.candidateId,
      scopeId: question.scopeId,
      answerAgrees,
      review,
      strictQualified: answerAgrees
        && review.isSolvable
        && review.hasUniqueCorrectAnswer
        && review.syllabusAligned
        && review.languageQuality === 'pass'
    };
  });
  const overall = metricsFor(rows);
  const byScope = Object.fromEntries(EXPECTED_SCOPES.map((scopeId) => [scopeId, metricsFor(rows.filter((row) => row.scopeId === scopeId))]));
  const failureCodes = [];
  if (overall.total < THRESHOLDS.minimumTotal) failureCodes.push('audit_sample_size_insufficient');
  if (EXPECTED_SCOPES.some((scopeId) => byScope[scopeId].total < THRESHOLDS.minimumPerScope)) failureCodes.push('audit_scope_coverage_insufficient');
  if ((overall.answerAgreementRate ?? 0) < THRESHOLDS.minimumAnswerAgreementRate) failureCodes.push('audit_answer_agreement_below_threshold');
  if ((overall.solvableRate ?? 0) < THRESHOLDS.minimumSolvableRate) failureCodes.push('audit_solvable_rate_below_threshold');
  if ((overall.uniqueAnswerRate ?? 0) < THRESHOLDS.minimumUniqueAnswerRate) failureCodes.push('audit_unique_answer_rate_below_threshold');
  if ((overall.syllabusAlignedRate ?? 0) < THRESHOLDS.minimumSyllabusAlignedRate) failureCodes.push('audit_syllabus_alignment_below_threshold');
  if ((overall.languagePassRate ?? 0) < THRESHOLDS.minimumLanguagePassRate) failureCodes.push('audit_language_pass_rate_below_threshold');
  if ((overall.strictQualifiedRate ?? 0) < THRESHOLDS.minimumStrictQualifiedRate) failureCodes.push('audit_strict_qualified_rate_below_threshold');
  const scopeQualityBelowThreshold = EXPECTED_SCOPES.some((scopeId) => {
    const metrics = byScope[scopeId];
    return (metrics.answerAgreementRate ?? 0) < THRESHOLDS.minimumAnswerAgreementRate
      || (metrics.solvableRate ?? 0) < THRESHOLDS.minimumSolvableRate
      || (metrics.uniqueAnswerRate ?? 0) < THRESHOLDS.minimumUniqueAnswerRate
      || (metrics.syllabusAlignedRate ?? 0) < THRESHOLDS.minimumSyllabusAlignedRate
      || (metrics.languagePassRate ?? 0) < THRESHOLDS.minimumLanguagePassRate
      || (metrics.strictQualifiedRate ?? 0) < THRESHOLDS.minimumStrictQualifiedRate;
  });
  if (scopeQualityBelowThreshold) failureCodes.push('audit_scope_quality_below_threshold');
  const qualityGatePassed = failureCodes.length === 0;
  return {
    scorePolicyVersion: SCORE_POLICY_VERSION,
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    batchId: manifest.batchId,
    status: qualityGatePassed ? 'shadow_generator_audit_passed' : 'shadow_generator_audit_failed',
    validEvidence: true,
    qualityGatePassed,
    failureCodes,
    thresholds: THRESHOLDS,
    overall,
    byScope,
    reviewerAttestation: reviewResponse.reviewerAttestation,
    evidenceHashes: {
      blindPacketSha256: manifest.blindPacketSha256,
      answerKeySha256: manifest.answerKeySha256,
      reviewResponseSha256: sha256(reviewResponse)
    },
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    publicationImpact: 'none',
    releaseQualification: false,
    releaseQualificationReason: 'human_review_of_locally_generated_candidates_is_not_an_official_holdout'
  };
}

function completeFixtureReview(batch) {
  const answerById = new Map(batch.answerKey.answers.map((item) => [item.candidateId, item.correctAnswer]));
  return {
    ...batch.reviewResponseTemplate,
    reviewerAttestation: {
      reviewerId: 'fixture-reviewer',
      reviewedWithoutAnswerKey: true,
      lockedAt: '2026-09-13T00:00:00.000Z'
    },
    reviews: batch.reviewResponseTemplate.reviews.map((review) => ({
      ...review,
      selectedOptionId: answerById.get(review.candidateId),
      isSolvable: true,
      hasUniqueCorrectAnswer: true,
      syllabusAligned: true,
      languageQuality: 'pass',
      notes: 'fixture-only complete review'
    }))
  };
}

function runSelfTest() {
  const batch = buildAuditBatch({ countPerSlot: 8, auditPerSlot: 8, auditSeed: 'score-self-test' });
  const reviewResponse = completeFixtureReview(batch);
  const passed = scoreAuditBatch({ ...batch, reviewResponse });
  if (!passed.qualityGatePassed || passed.overall.total !== 32) throw new Error('Complete valid audit fixture must pass.');
  const wrongAnswerResponse = JSON.parse(JSON.stringify(reviewResponse));
  wrongAnswerResponse.reviews[0].selectedOptionId = wrongAnswerResponse.reviews[0].selectedOptionId === 'A' ? 'B' : 'A';
  const wrongAnswer = scoreAuditBatch({ ...batch, reviewResponse: wrongAnswerResponse });
  if (wrongAnswer.qualityGatePassed || !wrongAnswer.failureCodes.includes('audit_answer_agreement_below_threshold')) throw new Error('Wrong reviewer answer must fail the zero-error answer threshold.');
  const dilutedScopeResponse = JSON.parse(JSON.stringify(reviewResponse));
  dilutedScopeResponse.reviews[0].languageQuality = 'minor_issue';
  const dilutedScope = scoreAuditBatch({ ...batch, reviewResponse: dilutedScopeResponse });
  if (dilutedScope.qualityGatePassed || !dilutedScope.failureCodes.includes('audit_scope_quality_below_threshold')) throw new Error('One weak scope must not be diluted by the other scopes.');
  const leakedAttestation = JSON.parse(JSON.stringify(reviewResponse));
  leakedAttestation.reviewerAttestation.reviewedWithoutAnswerKey = false;
  const invalidAttestation = scoreAuditBatch({ ...batch, reviewResponse: leakedAttestation });
  if (invalidAttestation.validEvidence || !invalidAttestation.failureCodes.includes('reviewer_blind_attestation_missing')) throw new Error('Non-blind review attestation must invalidate evidence.');
  const tamperedPacket = JSON.parse(JSON.stringify(batch.blindReviewPacket));
  tamperedPacket.questions[0].prompt += ' tampered';
  const tampered = scoreAuditBatch({ ...batch, blindReviewPacket: tamperedPacket, reviewResponse });
  if (tampered.validEvidence || !tampered.failureCodes.includes('blind_packet_hash_mismatch')) throw new Error('Tampered blind packet must invalidate evidence.');
  const incompleteResponse = JSON.parse(JSON.stringify(reviewResponse));
  incompleteResponse.reviews.pop();
  const incomplete = scoreAuditBatch({ ...batch, reviewResponse: incompleteResponse });
  if (incomplete.validEvidence || !incomplete.failureCodes.includes('review_response_candidate_set_mismatch')) throw new Error('Incomplete review set must invalidate evidence.');
  return {
    mode: 'math_elementary_local_blind_audit_score_self_test',
    status: 'passed',
    scorePolicyVersion: SCORE_POLICY_VERSION,
    positiveFixture: passed.status,
    negativeFixtures: {
      wrongAnswer: wrongAnswer.status,
      dilutedScope: dilutedScope.status,
      nonBlindAttestation: invalidAttestation.status,
      tamperedPacket: tampered.status,
      incompleteReview: incomplete.status
    },
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    publicationImpact: 'none'
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveAuditDirectory(rawDir) {
  if (!rawDir) throw new Error('Pass --dir=<workspace audit directory>.');
  const root = path.resolve(__dirname, '..');
  const target = path.resolve(root, rawDir);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('dir must resolve inside the CSCALITE workspace.');
  return target;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.stdout.write(`${JSON.stringify(runSelfTest(), null, 2)}\n`);
    return;
  }
  const rawDir = process.argv.find((value) => value.startsWith('--dir='))?.slice('--dir='.length);
  const auditDir = resolveAuditDirectory(rawDir);
  const inputs = {
    manifest: readJson(path.join(auditDir, 'manifest.json')),
    blindReviewPacket: readJson(path.join(auditDir, 'blind-review-packet.json')),
    answerKey: readJson(path.join(auditDir, 'answer-key.keep-private.json')),
    reviewResponse: readJson(path.join(auditDir, 'review-response.json'))
  };
  const report = scoreAuditBatch(inputs);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (process.argv.includes('--require-passed') && !report.qualityGatePassed) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { SCORE_POLICY_VERSION, THRESHOLDS, scoreAuditBatch, runSelfTest };
