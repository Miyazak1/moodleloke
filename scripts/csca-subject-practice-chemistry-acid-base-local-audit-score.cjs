#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { AUDIT_PROTOCOL_VERSION, buildAuditBatch } = require('./csca-subject-practice-chemistry-acid-base-local-audit-export.cjs');

const SCORE_POLICY_VERSION = 'chemistry-acid-base-local-blind-audit-score-v1';
const EXPECTED_SCOPES = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization']
  .flatMap((relation) => ['ph_value', 'acid_base_character']
    .map((target) => `chemistry-strong-acid-base-v3:${relation}:${target}`));
const THRESHOLDS = {
  minimumTotal: 48,
  minimumPerScope: 8,
  minimumAnswerAgreementRate: 1,
  minimumSolvableRate: 1,
  minimumUniqueAnswerRate: 1,
  minimumSyllabusAlignedRate: 1,
  minimumChemistryAssumptionsValidRate: 1,
  minimumLanguagePassRate: 0.95,
  minimumStrictQualifiedRate: 0.95
};

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function validateInputs({ manifest, blindReviewPacket, answerKey, reviewResponse }) {
  const failureCodes = [];
  if ([manifest, blindReviewPacket, answerKey, reviewResponse]
    .some((item) => item?.auditProtocolVersion !== AUDIT_PROTOCOL_VERSION)) failureCodes.push('audit_protocol_version_mismatch');
  if (manifest?.blindPacketSha256 !== sha256(blindReviewPacket)) failureCodes.push('blind_packet_hash_mismatch');
  if (manifest?.answerKeySha256 !== sha256(answerKey)) failureCodes.push('answer_key_hash_mismatch');
  if (reviewResponse?.blindPacketSha256 !== manifest?.blindPacketSha256) failureCodes.push('review_response_blind_packet_binding_mismatch');
  const attestation = reviewResponse?.reviewerAttestation;
  if (!attestation || typeof attestation.reviewerId !== 'string' || !attestation.reviewerId.trim()) failureCodes.push('reviewer_identity_missing');
  if (attestation?.reviewedWithoutAnswerKey !== true) failureCodes.push('reviewer_blind_attestation_missing');
  if (typeof attestation?.lockedAt !== 'string' || !Number.isFinite(Date.parse(attestation.lockedAt))) failureCodes.push('review_lock_timestamp_missing_or_invalid');
  const questions = Array.isArray(blindReviewPacket?.questions) ? blindReviewPacket.questions : [];
  const answers = Array.isArray(answerKey?.answers) ? answerKey.answers : [];
  const reviews = Array.isArray(reviewResponse?.reviews) ? reviewResponse.reviews : [];
  const idsFor = (items) => items.map((item) => item?.candidateId).filter(Boolean);
  const questionIds = idsFor(questions);
  const answerIds = idsFor(answers);
  const reviewIds = idsFor(reviews);
  const canonical = (items) => [...items].sort().join('|');
  if (questionIds.length !== manifest?.selectedAuditCount || new Set(questionIds).size !== questionIds.length) failureCodes.push('blind_packet_candidate_set_invalid');
  if (answerIds.length !== questionIds.length || new Set(answerIds).size !== answerIds.length) failureCodes.push('answer_key_candidate_set_invalid');
  if (reviewIds.length !== questionIds.length || new Set(reviewIds).size !== reviewIds.length) failureCodes.push('review_response_candidate_set_invalid');
  const expectedSet = canonical(questionIds);
  if (canonical(Array.isArray(manifest?.selectedCandidateIds) ? manifest.selectedCandidateIds : []) !== expectedSet) failureCodes.push('manifest_candidate_set_mismatch');
  if (canonical(answerIds) !== expectedSet) failureCodes.push('answer_key_candidate_set_mismatch');
  if (canonical(reviewIds) !== expectedSet) failureCodes.push('review_response_candidate_set_mismatch');
  for (const question of questions) {
    if (!EXPECTED_SCOPES.includes(question?.scopeId)) failureCodes.push('blind_packet_scope_invalid');
    const fingerprint = sha256({
      prompt: question?.prompt,
      optionTextsIgnoringPosition: Array.isArray(question?.options) ? question.options.map((option) => option?.text).sort() : []
    });
    if (question?.semanticFingerprint !== fingerprint) failureCodes.push('blind_packet_semantic_fingerprint_mismatch');
  }
  for (const review of reviews) {
    const question = questions.find((item) => item?.candidateId === review?.candidateId);
    if (!['A', 'B', 'C', 'D'].includes(review?.selectedOptionId)) failureCodes.push('review_selected_option_invalid');
    if (question && !question.options.some((option) => option?.id === review?.selectedOptionId)) failureCodes.push('review_selected_option_not_present');
    for (const key of ['isSolvable', 'hasUniqueCorrectAnswer', 'syllabusAligned', 'chemistryAssumptionsValid']) {
      if (typeof review?.[key] !== 'boolean') failureCodes.push(`review_${key}_verdict_invalid`);
    }
    if (!['pass', 'minor_issue', 'fail'].includes(review?.languageQuality)) failureCodes.push('review_language_quality_invalid');
    if (typeof review?.notes !== 'string') failureCodes.push('review_notes_invalid');
  }
  if (answers.some((answer) => !['A', 'B', 'C', 'D'].includes(answer?.correctAnswer))) failureCodes.push('answer_key_option_invalid');
  return { valid: failureCodes.length === 0, failureCodes: [...new Set(failureCodes)], questions, answers, reviews };
}

function metricsFor(rows) {
  const total = rows.length;
  const count = (predicate) => rows.filter(predicate).length;
  const answerAgreementCount = count((row) => row.answerAgrees);
  const solvableCount = count((row) => row.review.isSolvable);
  const uniqueAnswerCount = count((row) => row.review.hasUniqueCorrectAnswer);
  const syllabusAlignedCount = count((row) => row.review.syllabusAligned);
  const chemistryAssumptionsValidCount = count((row) => row.review.chemistryAssumptionsValid);
  const languagePassCount = count((row) => row.review.languageQuality === 'pass');
  const strictQualifiedCount = count((row) => row.strictQualified);
  return {
    total,
    answerAgreementCount, answerAgreementRate: rate(answerAgreementCount, total),
    solvableCount, solvableRate: rate(solvableCount, total),
    uniqueAnswerCount, uniqueAnswerRate: rate(uniqueAnswerCount, total),
    syllabusAlignedCount, syllabusAlignedRate: rate(syllabusAlignedCount, total),
    chemistryAssumptionsValidCount, chemistryAssumptionsValidRate: rate(chemistryAssumptionsValidCount, total),
    languagePassCount, languagePassRate: rate(languagePassCount, total),
    strictQualifiedCount, strictQualifiedRate: rate(strictQualifiedCount, total)
  };
}

function metricsPass(metrics) {
  return (metrics.answerAgreementRate ?? 0) >= THRESHOLDS.minimumAnswerAgreementRate
    && (metrics.solvableRate ?? 0) >= THRESHOLDS.minimumSolvableRate
    && (metrics.uniqueAnswerRate ?? 0) >= THRESHOLDS.minimumUniqueAnswerRate
    && (metrics.syllabusAlignedRate ?? 0) >= THRESHOLDS.minimumSyllabusAlignedRate
    && (metrics.chemistryAssumptionsValidRate ?? 0) >= THRESHOLDS.minimumChemistryAssumptionsValidRate
    && (metrics.languagePassRate ?? 0) >= THRESHOLDS.minimumLanguagePassRate
    && (metrics.strictQualifiedRate ?? 0) >= THRESHOLDS.minimumStrictQualifiedRate;
}

function scoreAuditBatch({ manifest, blindReviewPacket, answerKey, reviewResponse }) {
  const validation = validateInputs({ manifest, blindReviewPacket, answerKey, reviewResponse });
  if (!validation.valid) return {
    scorePolicyVersion: SCORE_POLICY_VERSION,
    status: 'invalid_audit_evidence', validEvidence: false, qualityGatePassed: false,
    failureCodes: validation.failureCodes,
    providerImpact: 'none_no_provider_call', dbImpact: 'none_no_database_connection', publicationImpact: 'none', releaseQualification: false
  };
  const questionById = new Map(validation.questions.map((item) => [item.candidateId, item]));
  const answerById = new Map(validation.answers.map((item) => [item.candidateId, item]));
  const rows = validation.reviews.map((review) => {
    const question = questionById.get(review.candidateId);
    const answerAgrees = review.selectedOptionId === answerById.get(review.candidateId).correctAnswer;
    return {
      candidateId: review.candidateId, scopeId: question.scopeId, answerAgrees, review,
      strictQualified: answerAgrees && review.isSolvable && review.hasUniqueCorrectAnswer
        && review.syllabusAligned && review.chemistryAssumptionsValid && review.languageQuality === 'pass'
    };
  });
  const overall = metricsFor(rows);
  const byScope = Object.fromEntries(EXPECTED_SCOPES.map((scope) => [scope, metricsFor(rows.filter((row) => row.scopeId === scope))]));
  const failureCodes = [];
  if (overall.total < THRESHOLDS.minimumTotal) failureCodes.push('audit_sample_size_insufficient');
  if (EXPECTED_SCOPES.some((scope) => byScope[scope].total < THRESHOLDS.minimumPerScope)) failureCodes.push('audit_scope_coverage_insufficient');
  if ((overall.answerAgreementRate ?? 0) < THRESHOLDS.minimumAnswerAgreementRate) failureCodes.push('audit_answer_agreement_below_threshold');
  if ((overall.solvableRate ?? 0) < THRESHOLDS.minimumSolvableRate) failureCodes.push('audit_solvable_rate_below_threshold');
  if ((overall.uniqueAnswerRate ?? 0) < THRESHOLDS.minimumUniqueAnswerRate) failureCodes.push('audit_unique_answer_rate_below_threshold');
  if ((overall.syllabusAlignedRate ?? 0) < THRESHOLDS.minimumSyllabusAlignedRate) failureCodes.push('audit_syllabus_alignment_below_threshold');
  if ((overall.chemistryAssumptionsValidRate ?? 0) < THRESHOLDS.minimumChemistryAssumptionsValidRate) failureCodes.push('audit_chemistry_assumptions_below_threshold');
  if ((overall.languagePassRate ?? 0) < THRESHOLDS.minimumLanguagePassRate) failureCodes.push('audit_language_pass_rate_below_threshold');
  if ((overall.strictQualifiedRate ?? 0) < THRESHOLDS.minimumStrictQualifiedRate) failureCodes.push('audit_strict_qualified_rate_below_threshold');
  if (EXPECTED_SCOPES.some((scope) => !metricsPass(byScope[scope]))) failureCodes.push('audit_scope_quality_below_threshold');
  const qualityGatePassed = failureCodes.length === 0;
  return {
    scorePolicyVersion: SCORE_POLICY_VERSION, auditProtocolVersion: AUDIT_PROTOCOL_VERSION, batchId: manifest.batchId,
    status: qualityGatePassed ? 'shadow_generator_audit_passed' : 'shadow_generator_audit_failed',
    validEvidence: true, qualityGatePassed, failureCodes, thresholds: THRESHOLDS, overall, byScope,
    reviewerAttestation: reviewResponse.reviewerAttestation,
    evidenceHashes: {
      blindPacketSha256: manifest.blindPacketSha256,
      answerKeySha256: manifest.answerKeySha256,
      reviewResponseSha256: sha256(reviewResponse)
    },
    providerImpact: 'none_no_provider_call', dbImpact: 'none_no_database_connection', publicationImpact: 'none',
    releaseQualification: false,
    releaseQualificationReason: 'human_review_of_locally_generated_candidates_is_not_an_official_holdout'
  };
}

function completeFixtureReview(batch) {
  const answerById = new Map(batch.answerKey.answers.map((item) => [item.candidateId, item.correctAnswer]));
  return {
    ...batch.reviewResponseTemplate,
    reviewerAttestation: { reviewerId: 'fixture-reviewer', reviewedWithoutAnswerKey: true, lockedAt: '2026-09-13T00:00:00.000Z' },
    reviews: batch.reviewResponseTemplate.reviews.map((review) => ({
      ...review, selectedOptionId: answerById.get(review.candidateId), isSolvable: true,
      hasUniqueCorrectAnswer: true, syllabusAligned: true, chemistryAssumptionsValid: true,
      languageQuality: 'pass', notes: 'fixture-only complete review'
    }))
  };
}

function runSelfTest() {
  const batch = buildAuditBatch({ countPerSlot: 8, auditPerSlot: 8, auditSeed: 'chemistry-score-self-test' });
  const reviewResponse = completeFixtureReview(batch);
  const passed = scoreAuditBatch({ ...batch, reviewResponse });
  if (!passed.qualityGatePassed || passed.overall.total !== 48) throw new Error('Valid complete fixture must pass.');
  const wrongAnswerResponse = structuredClone(reviewResponse);
  wrongAnswerResponse.reviews[0].selectedOptionId = wrongAnswerResponse.reviews[0].selectedOptionId === 'A' ? 'B' : 'A';
  const wrongAnswer = scoreAuditBatch({ ...batch, reviewResponse: wrongAnswerResponse });
  if (wrongAnswer.qualityGatePassed || !wrongAnswer.failureCodes.includes('audit_answer_agreement_below_threshold')) throw new Error('Wrong answer must fail.');
  const invalidChemistryResponse = structuredClone(reviewResponse);
  invalidChemistryResponse.reviews[0].chemistryAssumptionsValid = false;
  const invalidChemistry = scoreAuditBatch({ ...batch, reviewResponse: invalidChemistryResponse });
  if (invalidChemistry.qualityGatePassed || !invalidChemistry.failureCodes.includes('audit_chemistry_assumptions_below_threshold')) throw new Error('Invalid chemistry assumptions must fail.');
  const nonBlindResponse = structuredClone(reviewResponse);
  nonBlindResponse.reviewerAttestation.reviewedWithoutAnswerKey = false;
  const nonBlind = scoreAuditBatch({ ...batch, reviewResponse: nonBlindResponse });
  if (nonBlind.validEvidence || !nonBlind.failureCodes.includes('reviewer_blind_attestation_missing')) throw new Error('Non-blind evidence must be invalid.');
  const tamperedPacket = structuredClone(batch.blindReviewPacket);
  tamperedPacket.questions[0].prompt += ' tampered';
  const tampered = scoreAuditBatch({ ...batch, blindReviewPacket: tamperedPacket, reviewResponse });
  if (tampered.validEvidence || !tampered.failureCodes.includes('blind_packet_hash_mismatch')) throw new Error('Tampered packet must be invalid.');
  const incompleteResponse = structuredClone(reviewResponse);
  incompleteResponse.reviews.pop();
  const incomplete = scoreAuditBatch({ ...batch, reviewResponse: incompleteResponse });
  if (incomplete.validEvidence || !incomplete.failureCodes.includes('review_response_candidate_set_mismatch')) throw new Error('Incomplete review must be invalid.');
  return {
    mode: 'chemistry_acid_base_local_blind_audit_score_self_test', status: 'passed', scorePolicyVersion: SCORE_POLICY_VERSION,
    positiveFixture: passed.status,
    negativeFixtures: {
      wrongAnswer: wrongAnswer.status, invalidChemistryAssumptions: invalidChemistry.status,
      nonBlindAttestation: nonBlind.status, tamperedPacket: tampered.status, incompleteReview: incomplete.status
    },
    providerImpact: 'none_no_provider_call', dbImpact: 'none_no_database_connection', publicationImpact: 'none'
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  if (process.argv.includes('--self-test')) return process.stdout.write(`${JSON.stringify(runSelfTest(), null, 2)}\n`);
  const auditDirArg = process.argv.find((value) => value.startsWith('--audit-dir='))?.slice(12);
  if (!auditDirArg) throw new Error('Pass --audit-dir=<workspace-relative audit directory>.');
  const workspace = path.resolve(__dirname, '..');
  const auditDir = path.resolve(workspace, auditDirArg);
  if (!auditDir.startsWith(`${workspace}${path.sep}`)) throw new Error('audit-dir must resolve inside the CSCALITE workspace.');
  const report = scoreAuditBatch({
    manifest: readJson(path.join(auditDir, 'manifest.json')),
    blindReviewPacket: readJson(path.join(auditDir, 'blind-review-packet.json')),
    answerKey: readJson(path.join(auditDir, 'answer-key.keep-private.json')),
    reviewResponse: readJson(path.join(auditDir, 'review-response.json'))
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (process.argv.includes('--require-passed') && !report.qualityGatePassed) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { SCORE_POLICY_VERSION, EXPECTED_SCOPES, THRESHOLDS, scoreAuditBatch, runSelfTest };
