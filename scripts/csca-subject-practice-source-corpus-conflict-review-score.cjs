#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  REVIEW_PROTOCOL_VERSION,
  DECISION_VALUES
} = require('./csca-subject-practice-source-corpus-conflict-review-export.cjs');

const FIELD_DECISION_VALUES = Object.freeze(['use_local', 'use_database']);

function sha256(value) {
  return crypto.createHash('sha256').update(
    typeof value === 'string' ? value : JSON.stringify(value)
  ).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function readWorkspaceJson(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json') || !fs.existsSync(target)) {
    throw new Error('source_corpus_conflict_score_input_must_be_existing_workspace_json');
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function validLockedAt(value) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === text(value);
}

function scoreConflictReview({ manifest, reviewPacket, response }) {
  const reasonCodes = [];
  if (manifest.reviewProtocolVersion !== REVIEW_PROTOCOL_VERSION
    || reviewPacket.reviewProtocolVersion !== REVIEW_PROTOCOL_VERSION
    || response.reviewProtocolVersion !== REVIEW_PROTOCOL_VERSION) {
    reasonCodes.push('review_protocol_version_mismatch');
  }
  if (manifest.reviewPacketSha256 !== sha256(reviewPacket)
    || response.reviewPacketSha256 !== manifest.reviewPacketSha256) {
    reasonCodes.push('review_packet_hash_mismatch');
  }
  const conflicts = Array.isArray(reviewPacket.conflicts) ? reviewPacket.conflicts : [];
  const decisions = Array.isArray(response.decisions) ? response.decisions : [];
  const conflictIds = conflicts.map((conflict) => text(conflict.conflictId));
  const decisionIds = decisions.map((decision) => text(decision.conflictId));
  if (manifest.conflictCount !== conflicts.length
    || manifest.conflictIdSetSha256 !== sha256(conflictIds)
    || manifest.automaticResolutionCount !== 0
    || manifest.formalReleaseEligible !== false) {
    reasonCodes.push('review_manifest_binding_mismatch');
  }
  if (new Set(conflictIds).size !== conflictIds.length
    || new Set(decisionIds).size !== decisionIds.length
    || conflictIds.length !== decisionIds.length
    || [...conflictIds].sort().join('|') !== [...decisionIds].sort().join('|')) {
    reasonCodes.push('review_decision_id_set_mismatch');
  }
  if (!text(response.reviewerAttestation?.reviewerId)
    || response.reviewerAttestation?.primarySourceConsulted !== true
    || !validLockedAt(response.reviewerAttestation?.lockedAt)) {
    reasonCodes.push('reviewer_attestation_incomplete');
  }
  const conflictById = new Map(conflicts.map((conflict) => [conflict.conflictId, conflict]));
  const decisionCounts = Object.fromEntries(DECISION_VALUES.map((value) => [value, 0]));
  let invalidDecisionCount = 0;
  for (const decision of decisions) {
    if (!DECISION_VALUES.includes(decision.decision)) {
      invalidDecisionCount += 1;
      continue;
    }
    decisionCounts[decision.decision] += 1;
    const conflict = conflictById.get(decision.conflictId);
    if (!conflict) continue;
    const requiredFields = conflict.differingFields
      .filter((difference) => difference.status === 'content_conflict')
      .map((difference) => difference.field).sort();
    const submittedFields = Object.keys(decision.fieldDecisions ?? {}).sort();
    if (requiredFields.join('|') !== submittedFields.join('|')) {
      invalidDecisionCount += 1;
      continue;
    }
    if (decision.decision === 'field_by_field'
      && requiredFields.some((field) => !FIELD_DECISION_VALUES.includes(decision.fieldDecisions[field]))) {
      invalidDecisionCount += 1;
    }
  }
  if (invalidDecisionCount > 0) reasonCodes.push('review_decision_invalid_or_incomplete');
  const unresolvedCount = decisions.filter((decision) =>
    decision.decision === 'needs_primary_source_review'
    || (decision.decision === 'field_by_field'
      && Object.values(decision.fieldDecisions ?? {}).includes('needs_primary_source_review'))).length;
  const status = reasonCodes.length
    ? 'invalid_review_evidence'
    : unresolvedCount > 0 ? 'review_complete_with_unresolved_conflicts' : 'review_complete_ready_for_separate_import_validation';
  return {
    mode: 'subject_practice_source_corpus_conflict_review_score',
    scorePolicyVersion: 'subject-practice-source-corpus-conflict-review-score-v1',
    status,
    reasonCodes,
    conflictCount: conflicts.length,
    decisionCount: decisions.length,
    invalidDecisionCount,
    unresolvedCount,
    decisionCounts,
    reviewPacketSha256: manifest.reviewPacketSha256,
    responseSha256: sha256(response),
    automaticApplyPerformed: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_no_database_connection_or_write',
    publicationImpact: 'none_review_validation_only'
  };
}

function runSelfTest() {
  const conflict = {
    conflictId: 'source-conflict-fixture',
    differingFields: [{ field: 'answer', status: 'content_conflict' }]
  };
  const reviewPacket = { reviewProtocolVersion: REVIEW_PROTOCOL_VERSION, conflicts: [conflict] };
  const manifest = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    reviewPacketSha256: sha256(reviewPacket),
    conflictCount: 1,
    conflictIdSetSha256: sha256([conflict.conflictId]),
    automaticResolutionCount: 0,
    formalReleaseEligible: false
  };
  const validResponse = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    reviewPacketSha256: manifest.reviewPacketSha256,
    reviewerAttestation: {
      reviewerId: 'fixture-reviewer',
      primarySourceConsulted: true,
      lockedAt: '2026-09-13T00:00:00.000Z'
    },
    decisions: [{
      conflictId: conflict.conflictId,
      decision: 'use_local',
      fieldDecisions: { answer: null },
      notes: ''
    }]
  };
  const valid = scoreConflictReview({ manifest, reviewPacket, response: validResponse });
  const missing = scoreConflictReview({
    manifest, reviewPacket,
    response: { ...validResponse, decisions: [] }
  });
  const tampered = scoreConflictReview({
    manifest, reviewPacket: { ...reviewPacket, conflicts: [] }, response: validResponse
  });
  const tamperedManifest = scoreConflictReview({
    manifest: { ...manifest, conflictCount: 2 }, reviewPacket, response: validResponse
  });
  const invalidFieldDecision = scoreConflictReview({
    manifest, reviewPacket,
    response: {
      ...validResponse,
      decisions: [{
        ...validResponse.decisions[0],
        decision: 'field_by_field',
        fieldDecisions: { answer: null }
      }]
    }
  });
  const fieldLevelExclusion = scoreConflictReview({
    manifest, reviewPacket,
    response: {
      ...validResponse,
      decisions: [{
        ...validResponse.decisions[0],
        decision: 'field_by_field',
        fieldDecisions: { answer: 'exclude_from_complete_corpus' }
      }]
    }
  });
  const unresolved = scoreConflictReview({
    manifest, reviewPacket,
    response: {
      ...validResponse,
      decisions: [{ ...validResponse.decisions[0], decision: 'needs_primary_source_review' }]
    }
  });
  const checks = {
    validLockedReviewAccepted: valid.status === 'review_complete_ready_for_separate_import_validation',
    missingDecisionRejected: missing.status === 'invalid_review_evidence',
    tamperedPacketRejected: tampered.status === 'invalid_review_evidence',
    tamperedManifestRejected: tamperedManifest.status === 'invalid_review_evidence',
    incompleteFieldByFieldDecisionRejected: invalidFieldDecision.status === 'invalid_review_evidence',
    fieldLevelExclusionRejected: fieldLevelExclusion.status === 'invalid_review_evidence',
    unresolvedReviewCannotAdvance: unresolved.status === 'review_complete_with_unresolved_conflicts',
    scorerNeverAppliesChanges: valid.automaticApplyPerformed === false
  };
  return {
    mode: 'subject_practice_source_corpus_conflict_review_score_self_test',
    reportVersion: 'subject-practice-source-corpus-conflict-review-score-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

function argValue(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest();
  const manifestPath = argValue('manifest');
  const packetPath = argValue('review-packet');
  const responsePath = argValue('response');
  if (!manifestPath || !packetPath || !responsePath) {
    throw new Error('source_corpus_conflict_score_manifest_packet_and_response_required');
  }
  return scoreConflictReview({
    manifest: readWorkspaceJson(process.cwd(), manifestPath),
    reviewPacket: readWorkspaceJson(process.cwd(), packetPath),
    response: readWorkspaceJson(process.cwd(), responsePath)
  });
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'invalid_review_evidence') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { scoreConflictReview, runSelfTest };
