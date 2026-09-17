#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  REVIEW_PROTOCOL_VERSION
} = require('./csca-subject-practice-source-corpus-conflict-review-export.cjs');
const {
  scoreConflictReview
} = require('./csca-subject-practice-source-corpus-conflict-review-score.cjs');

const SOURCE_FIELDS = Object.freeze(['prompt', 'options', 'answer', 'explanation', 'localizations']);
const MATERIALIZATION_VERSION = 'subject-practice-source-corpus-conflict-resolution-overlay-v1';

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
    throw new Error('source_corpus_resolution_input_must_be_existing_workspace_json');
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function outputWorkspaceJson(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json') || fs.existsSync(target)) {
    throw new Error('source_corpus_resolution_output_must_be_new_workspace_json');
  }
  return target;
}

function resolvedRevisionFor(conflict, decision) {
  if (decision.decision === 'exclude_from_complete_corpus') return null;
  if (decision.decision === 'use_local') return conflict.localRevisionContext;
  if (decision.decision === 'use_database') return conflict.databaseRevisionContext;
  if (decision.decision !== 'field_by_field') {
    throw new Error('source_corpus_resolution_unresolved_decision');
  }
  return Object.fromEntries(SOURCE_FIELDS.map((field) => {
    const source = decision.fieldDecisions[field];
    if (source === 'use_database') return [field, conflict.databaseRevisionContext[field]];
    return [field, conflict.localRevisionContext[field]];
  }));
}

function materializeConflictResolution({ manifest, reviewPacket, response }) {
  const score = scoreConflictReview({ manifest, reviewPacket, response });
  if (score.status !== 'review_complete_ready_for_separate_import_validation') {
    throw new Error(`source_corpus_resolution_review_not_ready:${score.status}`);
  }
  const decisionById = new Map(response.decisions.map((decision) => [decision.conflictId, decision]));
  const entries = reviewPacket.conflicts.map((conflict) => {
    const decision = decisionById.get(conflict.conflictId);
    if (!decision) throw new Error('source_corpus_resolution_decision_missing_after_score');
    const resolvedRevision = resolvedRevisionFor(conflict, decision);
    return {
      conflictId: conflict.conflictId,
      documentIdentity: conflict.documentIdentity,
      questionNumber: conflict.questionNumber,
      localSourceFile: conflict.localSourceFile,
      databaseDocumentId: conflict.databaseDocumentId,
      databaseQuestionId: conflict.databaseQuestionId,
      resolution: decision.decision,
      resolvedRevision,
      resolvedRevisionSha256: resolvedRevision ? sha256(resolvedRevision) : null,
      excludedFromCompleteCorpus: resolvedRevision === null,
      reviewerNotes: text(decision.notes)
    };
  }).sort((left, right) => left.conflictId.localeCompare(right.conflictId));
  const overlay = {
    materializationVersion: MATERIALIZATION_VERSION,
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    confidentiality: 'local_internal_resolution_overlay_never_send_to_generator_or_student',
    reviewPacketSha256: manifest.reviewPacketSha256,
    reviewResponseSha256: score.responseSha256,
    sourceDatabaseInventoryPayloadSha256: manifest.databaseInventoryPayloadSha256,
    sourceLocalSetSha256: manifest.localSourceSetSha256,
    entries
  };
  const materializationManifest = {
    materializationVersion: MATERIALIZATION_VERSION,
    status: 'resolution_overlay_ready_for_separate_corpus_rebuild_validation',
    reviewPacketSha256: manifest.reviewPacketSha256,
    reviewResponseSha256: score.responseSha256,
    overlaySha256: sha256(overlay),
    entryCount: entries.length,
    includedCount: entries.filter((entry) => !entry.excludedFromCompleteCorpus).length,
    excludedCount: entries.filter((entry) => entry.excludedFromCompleteCorpus).length,
    resolutionCounts: Object.fromEntries([
      'use_local', 'use_database', 'field_by_field', 'exclude_from_complete_corpus'
    ].map((resolution) => [resolution, entries.filter((entry) => entry.resolution === resolution).length])),
    sourceFilesModified: false,
    databaseWritePerformed: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_no_database_connection_or_write',
    publicationImpact: 'none_overlay_only'
  };
  return { materializationManifest, overlay };
}

function writeOverlay(workspaceRoot, output, result) {
  const target = outputWorkspaceJson(workspaceRoot, output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const artifact = {
    ...result,
    artifactSha256: sha256({
      materializationManifest: result.materializationManifest,
      overlay: result.overlay
    })
  };
  fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { target, artifactSha256: artifact.artifactSha256 };
}

function fixtureEvidence(decision) {
  const conflict = {
    conflictId: 'source-conflict-fixture',
    documentIdentity: 'math|fixture|en',
    questionNumber: '1',
    localSourceFile: 'docs/fixture.json',
    databaseDocumentId: 1,
    databaseQuestionId: 2,
    differingFields: [{ field: 'answer', status: 'content_conflict' }],
    localRevisionContext: {
      prompt: 'Find x.', options: [{ id: 'A', text: '1' }], answer: 'A', explanation: 'Local.', localizations: {}
    },
    databaseRevisionContext: {
      prompt: 'Find x.', options: [{ id: 'A', text: '1' }], answer: 'B', explanation: 'Database.', localizations: {}
    }
  };
  const reviewPacket = { reviewProtocolVersion: REVIEW_PROTOCOL_VERSION, conflicts: [conflict] };
  const manifest = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    reviewPacketSha256: sha256(reviewPacket),
    conflictCount: 1,
    conflictIdSetSha256: sha256([conflict.conflictId]),
    automaticResolutionCount: 0,
    formalReleaseEligible: false,
    databaseInventoryPayloadSha256: sha256('database'),
    localSourceSetSha256: sha256('local')
  };
  const response = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    reviewPacketSha256: manifest.reviewPacketSha256,
    reviewerAttestation: {
      reviewerId: 'fixture-reviewer',
      primarySourceConsulted: true,
      lockedAt: '2026-09-13T00:00:00.000Z'
    },
    decisions: [{
      conflictId: conflict.conflictId,
      decision,
      fieldDecisions: { answer: decision === 'field_by_field' ? 'use_database' : null },
      notes: ''
    }]
  };
  return { manifest, reviewPacket, response };
}

function runSelfTest() {
  const local = materializeConflictResolution(fixtureEvidence('use_local'));
  const database = materializeConflictResolution(fixtureEvidence('use_database'));
  const fieldByField = materializeConflictResolution(fixtureEvidence('field_by_field'));
  const excluded = materializeConflictResolution(fixtureEvidence('exclude_from_complete_corpus'));
  let unresolvedRejected = false;
  try {
    materializeConflictResolution(fixtureEvidence('needs_primary_source_review'));
  } catch (error) {
    unresolvedRejected = String(error.message).includes('review_not_ready');
  }
  const checks = {
    localResolutionUsesLocalAnswer: local.overlay.entries[0].resolvedRevision.answer === 'A',
    databaseResolutionUsesDatabaseAnswer: database.overlay.entries[0].resolvedRevision.answer === 'B',
    fieldResolutionUsesSelectedAnswer: fieldByField.overlay.entries[0].resolvedRevision.answer === 'B',
    exclusionHasNoResolvedRevision: excluded.overlay.entries[0].resolvedRevision === null
      && excluded.materializationManifest.excludedCount === 1,
    unresolvedReviewRejected: unresolvedRejected,
    materializerNeverModifiesSourcesOrDatabase: local.materializationManifest.sourceFilesModified === false
      && local.materializationManifest.databaseWritePerformed === false,
    overlayRemainsNonqualifying: local.materializationManifest.formalReleaseEligible === false
  };
  return {
    mode: 'subject_practice_source_corpus_conflict_resolution_materialize_self_test',
    reportVersion: `${MATERIALIZATION_VERSION}-self-test-v1`,
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
  const outputPath = argValue('out');
  if (!manifestPath || !packetPath || !responsePath) {
    throw new Error('source_corpus_resolution_manifest_packet_and_response_required');
  }
  const result = materializeConflictResolution({
    manifest: readWorkspaceJson(process.cwd(), manifestPath),
    reviewPacket: readWorkspaceJson(process.cwd(), packetPath),
    response: readWorkspaceJson(process.cwd(), responsePath)
  });
  if (!outputPath) return {
    ...result.materializationManifest,
    mode: 'subject_practice_source_corpus_conflict_resolution_preview',
    outputWritten: false
  };
  const written = writeOverlay(process.cwd(), outputPath, result);
  return {
    ...result.materializationManifest,
    mode: 'subject_practice_source_corpus_conflict_resolution_export',
    outputWritten: true,
    outputPath: written.target,
    artifactSha256: written.artifactSha256
  };
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MATERIALIZATION_VERSION,
  resolvedRevisionFor,
  materializeConflictResolution,
  writeOverlay,
  runSelfTest,
  fixtureEvidence
};
