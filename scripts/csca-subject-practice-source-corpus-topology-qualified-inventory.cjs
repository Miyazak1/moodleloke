#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSubjectPracticeSourceCorpusInventoryManifest
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  buildSubjectPracticeSourceCorpusTopologyEvidence,
  createSubjectPracticeSourceCorpusTopologyAttestation,
  verifySubjectPracticeSourceCorpusTopologyAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');
const {
  buildLocalCorpus
} = require('./csca-subject-practice-source-corpus-scan.cjs');
const {
  verifyDbArtifact
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');

const MODE = 'subject_practice_source_corpus_topology_qualified_inventory_v1';

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256(value) {
  const serialized = Buffer.isBuffer(value) ? value
    : typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(text(value));
}

function payloadValid(artifact) {
  if (!artifact || !validSha256(artifact.payloadSha256)) return false;
  const { payloadSha256, ...payload } = artifact;
   return sha256(payload) === payloadSha256;
}

function sameCanonical(left, right) {
   return JSON.stringify(canonicalJsonValue(left)) === JSON.stringify(canonicalJsonValue(right));
}

function buildQualifiedInventory(input) {
  if (input.issueArtifact?.schemaVersion !== 'subject-practice-source-corpus-topology-attestation-issue-v1'
    || input.issueArtifact.mode !== 'subject_practice_source_corpus_topology_attestation_issue_v1'
    || input.issueArtifact.status !== 'attestation_issued_for_downstream_reverification'
    || input.issueArtifact.qualificationSerialized !== false
    || input.issueArtifact.requiresDownstreamAttestationReverification !== true
    || !payloadValid(input.issueArtifact)
    || input.issueArtifact.topologyEvidencePayloadSha256 !== input.evidence?.payloadSha256) {
    throw new Error('source_corpus_topology_qualified_inventory_issue_artifact_invalid');
  }
  const qualification = verifySubjectPracticeSourceCorpusTopologyAttestation({
    evidence: input.evidence,
    attestation: input.issueArtifact.attestation,
    secret: input.secret,
    allowedReviewerIds: input.allowedReviewerIds,
    allowedKeyIds: input.allowedKeyIds,
    now: input.now
  });
  if (!qualification) throw new Error('source_corpus_topology_qualified_inventory_attestation_invalid');
  if (!payloadValid(input.reconciliation)
    || input.reconciliation.schemaVersion !== 'subject-practice-source-corpus-inventory-reconcile-v3'
    || input.reconciliation.mode !== 'subject_practice_source_corpus_inventory_reconcile_v3'
    || input.reconciliation.localCorpusSnapshotSha256 !== input.currentLocalCorpusSnapshotSha256
    || input.reconciliation.dbInventoryPayloadSha256 !== input.databaseInventory?.payloadSha256
    || input.reconciliation.formalReleaseEligible !== false
       || !Number.isInteger(input.reconciliation.fullRevisionComparison?.contentConflictCount)) {
    throw new Error('source_corpus_topology_qualified_inventory_reconciliation_invalid_or_stale');
  }
  if (!verifyDbArtifact(input.databaseInventory)) {
    throw new Error('source_corpus_topology_qualified_inventory_database_inventory_invalid');
  }
  const availableSources = new Map(
    input.reconciliation.controlledInventoryManifest.sources.map((source) => [source.sourceId, source])
  );
  availableSources.set(input.databaseInventory.sourceInventory.sourceId, input.databaseInventory.sourceInventory);
  const databaseSourceInReconciliation = input.reconciliation.controlledInventoryManifest.sources
    .find((source) => source.sourceId === input.databaseInventory.sourceInventory.sourceId);
  if (!sameCanonical(databaseSourceInReconciliation, input.databaseInventory.sourceInventory)) {
    throw new Error('source_corpus_topology_qualified_inventory_database_source_binding_mismatch');
  }
  const sources = qualification.requiredSourceIds.map((sourceId) => availableSources.get(sourceId));
  if (sources.some((source) => !source)) {
    throw new Error('source_corpus_topology_qualified_inventory_required_source_missing');
  }
  if (sources.some((source) => qualification.excludedMirrorSourceIds.includes(source.sourceId))) {
    throw new Error('source_corpus_topology_qualified_inventory_mirror_in_required_set');
  }
  const manifest = buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: [...qualification.requiredSourceIds],
    sources,
    topology: {
      qualification,
      expectedEvidencePayloadSha256: input.evidence.payloadSha256,
      expectedEnvironmentId: input.evidence.environmentId,
      now: input.now
    }
  });
  if (manifest.coverageStatus !== 'all_system_known_source_exam_reference'
    || manifest.requiredSourceDerivation !== 'signed_topology_qualification') {
    throw new Error('source_corpus_topology_qualified_inventory_manifest_not_complete');
  }
  const unresolvedConflictCount = input.reconciliation.fullRevisionComparison.contentConflictCount;
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-topology-qualified-inventory-v1',
    mode: MODE,
    status: 'topology_qualified_inventory_built_nonqualifying_pending_corpus_rebuild',
    topologyEvidencePayloadSha256: input.evidence.payloadSha256,
    attestationIssuePayloadSha256: input.issueArtifact.payloadSha256,
    reconciliationPayloadSha256: input.reconciliation.payloadSha256,
    databaseInventoryPayloadSha256: input.databaseInventory.payloadSha256,
    currentLocalCorpusSnapshotSha256: input.currentLocalCorpusSnapshotSha256,
    inventoryManifest: manifest,
    excludedMirrorSourceIds: [...qualification.excludedMirrorSourceIds],
    unresolvedConflictCount,
    topologyQualificationVerified: true,
    requiresConflictResolutionOverlay: unresolvedConflictCount > 0,
    requiresCompleteStructuredCorpusRebuild: true,
    requiresScannerAttestation: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_existing_artifacts_and_local_source_files_only',
    publicationImpact: 'none'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function list(value) {
  return Array.from(new Set(text(value).split(',').map((item) => item.trim()).filter(Boolean)));
}

function preflight(env = process.env) {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    topologySecretConfigured: text(env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET).length >= 32,
    reviewerAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS).length > 0,
    keyAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS).length > 0,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function inventorySource(sourceId, kind) {
  return {
    sourceId,
    kind,
    locatorFingerprintSha256: sha256(`locator:${sourceId}`),
    expectedCount: 1,
    observedCount: 1,
    highWatermark: 'fixture-watermark',
    updatedAt: '2026-09-13T08:00:00.000Z',
    extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
    status: 'complete'
  };
}

function fixture(options = {}) {
  const secret = 'fixture-qualified-inventory-secret-0000001';
  const localSource = inventorySource('local_repository_source_json', 'local_file');
  const databaseSource = inventorySource('production_csca_source_questions', 'database_query');
  const evidence = buildSubjectPracticeSourceCorpusTopologyEvidence({
    environmentId: 'fixture-production',
    topologySnapshotId: 'fixture-qualified-inventory',
    discoverySurfaceIds: ['fixture-registry'],
    sources: [
      {
        sourceId: localSource.sourceId, kind: localSource.kind, role: 'independent_source',
        canonicalSystemId: 'fixture-local', locatorFingerprintSha256: localSource.locatorFingerprintSha256,
        discoveryEvidenceSha256: sha256('local-discovery'), mirrorOfSourceId: null,
        mirrorRelationEvidenceSha256: null, active: true
      },
      {
        sourceId: databaseSource.sourceId, kind: databaseSource.kind, role: 'independent_source',
        canonicalSystemId: 'fixture-db', locatorFingerprintSha256: databaseSource.locatorFingerprintSha256,
        discoveryEvidenceSha256: sha256('db-discovery'), mirrorOfSourceId: null,
        mirrorRelationEvidenceSha256: null, active: true
      },
      {
        sourceId: 'online_database_dump', kind: 'remote_sync', role: 'backup_mirror',
        canonicalSystemId: 'fixture-db', locatorFingerprintSha256: sha256('dump-locator'),
        discoveryEvidenceSha256: sha256('dump-discovery'), mirrorOfSourceId: databaseSource.sourceId,
        mirrorRelationEvidenceSha256: sha256('dump-mirror-relation'), active: true
      }
    ],
    capturedAt: '2026-09-13T08:00:00.000Z'
  });
  const attestation = createSubjectPracticeSourceCorpusTopologyAttestation({
    evidence, reviewerId: 'fixture-reviewer', keyId: 'fixture-key',
    issuedAt: '2026-09-13T09:00:00.000Z', expiresAt: '2026-09-14T09:00:00.000Z', secret
  });
  const issuePayload = {
    schemaVersion: 'subject-practice-source-corpus-topology-attestation-issue-v1',
    mode: 'subject_practice_source_corpus_topology_attestation_issue_v1',
    status: 'attestation_issued_for_downstream_reverification',
    topologyEvidencePayloadSha256: evidence.payloadSha256,
    qualificationSerialized: false,
    requiresDownstreamAttestationReverification: true,
    attestation
  };
  const issueArtifact = { ...issuePayload, payloadSha256: sha256(issuePayload) };
  const databasePayload = {
    schemaVersion: 'subject-practice-source-corpus-db-inventory-v2',
    mode: 'subject_practice_source_corpus_db_inventory_v2',
    sourceInventory: databaseSource,
    databaseImpact: 'read_only_repeatable_read_transaction'
  };
  const databaseInventory = { ...databasePayload, payloadSha256: sha256(databasePayload) };
  const localSnapshot = sha256('current-local-snapshot');
  const reconciliationPayload = {
    schemaVersion: 'subject-practice-source-corpus-inventory-reconcile-v3',
    mode: 'subject_practice_source_corpus_inventory_reconcile_v3',
    localCorpusSnapshotSha256: localSnapshot,
    dbInventoryPayloadSha256: databaseInventory.payloadSha256,
    fullRevisionComparison: {
      contentConflictCount: Number.isInteger(options.contentConflictCount)
        ? options.contentConflictCount : 58
    },
    controlledInventoryManifest: { sources: [localSource, databaseSource] },
    formalReleaseEligible: false
  };
  const reconciliation = { ...reconciliationPayload, payloadSha256: sha256(reconciliationPayload) };
  return {
    evidence, issueArtifact, reconciliation, databaseInventory, secret,
    allowedReviewerIds: ['fixture-reviewer'], allowedKeyIds: ['fixture-key'],
    now: '2026-09-13T10:00:00.000Z', currentLocalCorpusSnapshotSha256: localSnapshot
  };
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

function runSelfTest() {
  const input = fixture();
  const built = buildQualifiedInventory(input);
  const checks = {
    signedTopologyBuildsCompleteInventory: built.inventoryManifest.coverageStatus
      === 'all_system_known_source_exam_reference'
      && built.inventoryManifest.requiredSourceDerivation === 'signed_topology_qualification',
    callerCannotChooseRequiredSet: JSON.stringify(built.inventoryManifest.requiredSourceIds)
      === JSON.stringify(['local_repository_source_json', 'production_csca_source_questions']),
    backupMirrorExcludedFromInventory: built.excludedMirrorSourceIds.includes('online_database_dump')
      && !built.inventoryManifest.requiredSourceIds.includes('online_database_dump')
      && !built.inventoryManifest.sources.some((source) => source.sourceId === 'online_database_dump'),
    conflictsStillBlockFormalProgress: built.unresolvedConflictCount === 58
      && built.requiresConflictResolutionOverlay === true
      && built.formalReleaseEligible === false,
    staleLocalSnapshotRejected: throws(() => buildQualifiedInventory({
      ...input, currentLocalCorpusSnapshotSha256: sha256('changed-local-snapshot')
    })),
    expiredAttestationRejected: throws(() => buildQualifiedInventory({
      ...input, now: '2026-09-15T10:00:00.000Z'
    })),
    tamperedIssueArtifactRejected: throws(() => buildQualifiedInventory({
      ...input, issueArtifact: { ...input.issueArtifact, qualificationSerialized: true }
    })),
    wrongSecretRejected: throws(() => buildQualifiedInventory({
      ...input, secret: 'wrong-secret-that-is-long-enough-00000001'
    })),
    copiedDatabaseSourceBindingRejected: throws(() => buildQualifiedInventory({
      ...input,
      reconciliation: {
        ...input.reconciliation,
        controlledInventoryManifest: {
          sources: input.reconciliation.controlledInventoryManifest.sources.map((source) =>
            source.sourceId === 'production_csca_source_questions'
              ? { ...source, observedCount: 2 } : source)
        }
      }
    })),
    defaultPreflightDoesNotReadOrWrite: preflight({}).status === 'preflight_only_no_files_read_or_written'
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-topology-qualified-inventory-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

function workspaceJson(workspaceRoot, value, mustBeNew = false) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (mustBeNew ? fs.existsSync(target) : !fs.existsSync(target))) {
    throw new Error('source_corpus_topology_qualified_inventory_path_invalid');
  }
  return target;
}

function argValue(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest();
  if (!process.argv.includes('--execute')) return preflight();
  const workspaceRoot = process.cwd();
  const files = ['evidence', 'issue', 'reconciliation', 'db-inventory'];
  const args = Object.fromEntries(files.map((name) => [name, argValue(name)]));
  const now = argValue('now');
  const out = argValue('out');
  if (files.some((name) => !args[name]) || !now || !out) {
    throw new Error('source_corpus_topology_qualified_inventory_required_argument_missing');
  }
  const localCorpus = buildLocalCorpus(workspaceRoot);
  const env = process.env;
  const built = buildQualifiedInventory({
    evidence: JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, args.evidence), 'utf8')),
    issueArtifact: JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, args.issue), 'utf8')),
    reconciliation: JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, args.reconciliation), 'utf8')),
    databaseInventory: JSON.parse(fs.readFileSync(workspaceJson(workspaceRoot, args['db-inventory']), 'utf8')),
    secret: env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET,
    allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS),
    allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS),
    now,
    currentLocalCorpusSnapshotSha256: localCorpus.snapshotSha256
  });
  const outputPath = workspaceJson(workspaceRoot, out, true);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(built, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...built, outputPath };
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { MODE, buildQualifiedInventory, preflight, runSelfTest, fixture };
