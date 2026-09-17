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
  buildSubjectPracticeSourceCorpusTopologyEvidence
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');
const {
  verifyDbArtifact
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');

const MODE = 'subject_practice_source_corpus_topology_review_export_v1';

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

function payloadValid(artifact, canonical = true) {
  if (!artifact || !validSha256(artifact.payloadSha256)) return false;
  const { payloadSha256, ...payload } = artifact;
  const serialized = canonical ? JSON.stringify(canonicalJsonValue(payload)) : JSON.stringify(payload);
  return sha256(serialized) === payloadSha256;
}

function workspaceInput(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json') || !fs.existsSync(target)) {
    throw new Error('source_corpus_topology_review_input_invalid_or_outside_workspace');
  }
  return target;
}

function newWorkspaceDirectory(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || fs.existsSync(target)) {
    throw new Error('source_corpus_topology_review_output_must_be_new_workspace_directory');
  }
  return target;
}

function validateInputs({ reconciliation, databaseInventory, dumpAudit }) {
  if (reconciliation?.schemaVersion !== 'subject-practice-source-corpus-inventory-reconcile-v3'
    || reconciliation.mode !== 'subject_practice_source_corpus_inventory_reconcile_v3'
    || !payloadValid(reconciliation, true)
    || reconciliation.dbInventoryPayloadSha256 !== databaseInventory?.payloadSha256
    || reconciliation.formalReleaseEligible !== false
    || reconciliation.fullRevisionComparison?.contentConflictCount !== 58
    || reconciliation.controlledInventoryManifest?.requiredSourceDerivation !== 'caller_declared_unqualified'
    || !reconciliation.controlledInventoryManifest?.reasonCodes?.includes(
      'source_corpus_inventory_topology_qualification_missing'
    )) throw new Error('source_corpus_topology_review_reconciliation_invalid');
  if (!verifyDbArtifact(databaseInventory)) {
    throw new Error('source_corpus_topology_review_database_inventory_invalid');
  }
  if (dumpAudit?.schemaVersion !== 'subject-practice-source-corpus-dump-mirror-audit-v3'
    || dumpAudit.mode !== 'subject_practice_source_corpus_dump_mirror_audit_v3'
    || !payloadValid(dumpAudit, false)
    || dumpAudit.databaseInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || dumpAudit.classification !== 'database_backup_mirror_not_independent_source_inventory'
    || dumpAudit.independentRemoteSourceEligible !== false
    || dumpAudit.questionComparison?.exact !== true
    || dumpAudit.documentComparison?.exact !== true) {
    throw new Error('source_corpus_topology_review_dump_audit_invalid');
  }
}

function buildReviewDraft(input) {
  validateInputs(input);
  const localSource = input.reconciliation.controlledInventoryManifest.sources
    .find((source) => source.sourceId === 'local_repository_source_json');
  const databaseSource = input.databaseInventory.sourceInventory;
  if (!localSource || localSource.status !== 'complete' || databaseSource?.status !== 'complete') {
    throw new Error('source_corpus_topology_review_independent_source_inventory_missing');
  }
  const topologyEvidence = buildSubjectPracticeSourceCorpusTopologyEvidence({
    environmentId: text(input.environmentId),
    topologySnapshotId: text(input.topologySnapshotId),
    discoverySurfaceIds: [
      'repository_source_json_inventory',
      'production_database_read_only_inventory',
      'database_dump_mirror_audit',
      'runtime_deployment_storage_and_sync_review_required'
    ],
    sources: [
      {
        sourceId: localSource.sourceId,
        kind: 'local_file',
        role: 'independent_source',
        canonicalSystemId: 'cscalite_local_curated_source_json',
        locatorFingerprintSha256: localSource.locatorFingerprintSha256,
        discoveryEvidenceSha256: input.reconciliation.payloadSha256,
        mirrorOfSourceId: null,
        mirrorRelationEvidenceSha256: null,
        active: true
      },
      {
        sourceId: databaseSource.sourceId,
        kind: 'database_query',
        role: 'independent_source',
        canonicalSystemId: 'cscalite_production_source_database',
        locatorFingerprintSha256: databaseSource.locatorFingerprintSha256,
        discoveryEvidenceSha256: input.databaseInventory.payloadSha256,
        mirrorOfSourceId: null,
        mirrorRelationEvidenceSha256: null,
        active: true
      },
      {
        sourceId: 'online_database_dump',
        kind: 'remote_sync',
        role: 'backup_mirror',
        canonicalSystemId: 'cscalite_production_source_database',
        locatorFingerprintSha256: input.dumpAudit.dumpFileSha256,
        discoveryEvidenceSha256: input.dumpAudit.payloadSha256,
        mirrorOfSourceId: databaseSource.sourceId,
        mirrorRelationEvidenceSha256: input.dumpAudit.payloadSha256,
        active: true
      }
    ],
    capturedAt: input.capturedAt
  });
  const reviewTemplate = {
    schemaVersion: 'subject-practice-source-corpus-topology-review-response-v1',
    topologyEvidencePayloadSha256: topologyEvidence.payloadSha256,
    reviewerId: '',
    primarySurfaceReview: {
      repositorySourceRegistryAndFilesReviewed: false,
      productionDatabaseSchemaAndInventoryReviewed: false,
      deploymentStorageConfigurationReviewed: false,
      runtimeRemoteSyncImplementationReviewed: false,
      backupAndRestoreTopologyReviewed: false
    },
    confirmsAllActiveIndependentSourcesListed: false,
    confirmsBackupMirrorClassification: false,
    decision: 'needs_primary_topology_review',
    notes: '',
    lockedAt: null
  };
  const manifestPayload = {
    schemaVersion: 'subject-practice-source-corpus-topology-review-manifest-v1',
    mode: MODE,
    status: 'awaiting_human_topology_review_and_attestation',
    topologyEvidencePayloadSha256: topologyEvidence.payloadSha256,
    reconciliationPayloadSha256: input.reconciliation.payloadSha256,
    databaseInventoryPayloadSha256: input.databaseInventory.payloadSha256,
    dumpMirrorAuditPayloadSha256: input.dumpAudit.payloadSha256,
    proposedRequiredSourceIds: topologyEvidence.sources
      .filter((source) => source.active && source.role === 'independent_source')
      .map((source) => source.sourceId).sort(),
    proposedExcludedMirrorSourceIds: topologyEvidence.sources
      .filter((source) => source.active && source.role === 'backup_mirror')
      .map((source) => source.sourceId).sort(),
    reviewResponseTemplateSha256: sha256(reviewTemplate),
    realHumanReviewPresent: false,
    topologyAttestationIssued: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_existing_artifacts_only',
    publicationImpact: 'none'
  };
  return {
    topologyEvidence,
    reviewTemplate,
    manifest: { ...manifestPayload, payloadSha256: sha256(manifestPayload) }
  };
}

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    outputFiles: ['topology-evidence.draft.json', 'review-response-template.json', 'manifest.json'],
    issuesAttestation: false,
    requiresHumanPrimaryTopologyReview: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function runSelfTest() {
  const inventorySource = (sourceId, kind) => ({
    sourceId,
    kind,
    locatorFingerprintSha256: sha256(`locator:${sourceId}`),
    expectedCount: 1,
    observedCount: 1,
    highWatermark: 'fixture-watermark',
    updatedAt: '2026-09-13T08:00:00.000Z',
    extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
    status: 'complete'
  });
  const databasePayload = {
    schemaVersion: 'subject-practice-source-corpus-db-inventory-v2',
    mode: 'subject_practice_source_corpus_db_inventory_v2',
    sourceInventory: inventorySource('production_csca_source_questions', 'database_query'),
    databaseImpact: 'read_only_repeatable_read_transaction'
  };
  const databaseInventory = { ...databasePayload, payloadSha256: sha256(databasePayload) };
  const reconciliationPayload = {
    schemaVersion: 'subject-practice-source-corpus-inventory-reconcile-v3',
    mode: 'subject_practice_source_corpus_inventory_reconcile_v3',
    dbInventoryPayloadSha256: databaseInventory.payloadSha256,
    localCorpusSnapshotSha256: sha256('local-snapshot'),
    fullRevisionComparison: { contentConflictCount: 58 },
    controlledInventoryManifest: {
      requiredSourceDerivation: 'caller_declared_unqualified',
      reasonCodes: ['source_corpus_inventory_topology_qualification_missing'],
      sources: [inventorySource('local_repository_source_json', 'local_file')]
    },
    formalReleaseEligible: false
  };
  const reconciliation = {
    ...reconciliationPayload,
    payloadSha256: sha256(reconciliationPayload)
  };
  const dumpPayload = {
    schemaVersion: 'subject-practice-source-corpus-dump-mirror-audit-v3',
    mode: 'subject_practice_source_corpus_dump_mirror_audit_v3',
    databaseInventoryPayloadSha256: databaseInventory.payloadSha256,
    dumpFileSha256: sha256('fixture-dump'),
    classification: 'database_backup_mirror_not_independent_source_inventory',
    independentRemoteSourceEligible: false,
    questionComparison: { exact: true },
    documentComparison: { exact: true }
  };
  const dumpAudit = {
    ...dumpPayload,
    payloadSha256: sha256(JSON.stringify(dumpPayload))
  };
  const draft = buildReviewDraft({
    reconciliation,
    databaseInventory,
    dumpAudit,
    environmentId: 'fixture-production',
    topologySnapshotId: 'fixture-review-topology',
    capturedAt: '2026-09-13T09:00:00.000Z'
  });
  const checks = {
    defaultIsSideEffectFreePreflight: preflight().status === 'preflight_only_no_files_read_or_written',
    exporterNeverIssuesAttestation: preflight().issuesAttestation === false,
    humanReviewRequired: preflight().requiresHumanPrimaryTopologyReview === true,
    formalQualificationNeverIssuedByExporter: preflight().formalReleaseEligible === false,
    canonicalPayloadOrderInvariant: sha256({ b: 2, a: 1 }) === sha256({ a: 1, b: 2 }),
    reviewDraftBindsAllInputArtifacts: draft.manifest.reconciliationPayloadSha256
      === reconciliation.payloadSha256
      && draft.manifest.databaseInventoryPayloadSha256 === databaseInventory.payloadSha256
      && draft.manifest.dumpMirrorAuditPayloadSha256 === dumpAudit.payloadSha256,
    independentSourcesProposedFromValidatedEvidence: JSON.stringify(draft.manifest.proposedRequiredSourceIds)
      === JSON.stringify(['local_repository_source_json', 'production_csca_source_questions']),
    databaseDumpProposedOnlyAsMirror: JSON.stringify(draft.manifest.proposedExcludedMirrorSourceIds)
      === JSON.stringify(['online_database_dump']),
    reviewDefaultsRemainUnapproved: draft.reviewTemplate.decision === 'needs_primary_topology_review'
      && Object.values(draft.reviewTemplate.primarySurfaceReview).every((value) => value === false)
      && draft.manifest.realHumanReviewPresent === false
      && draft.manifest.topologyAttestationIssued === false,
    tamperedReconciliationRejected: (() => {
      try {
        buildReviewDraft({
          reconciliation: { ...reconciliation, localCorpusSnapshotSha256: sha256('tampered') },
          databaseInventory, dumpAudit,
          environmentId: 'fixture-production', topologySnapshotId: 'fixture-review-topology',
          capturedAt: '2026-09-13T09:00:00.000Z'
        });
        return false;
      } catch { return true; }
    })()
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-topology-review-export-self-test-v1',
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
  if (!process.argv.includes('--execute')) return preflight();
  const required = ['reconciliation', 'db-inventory', 'dump-audit', 'environment-id', 'snapshot-id', 'captured-at', 'out-dir'];
  const args = Object.fromEntries(required.map((name) => [name, argValue(name)]));
  if (required.some((name) => !args[name])) throw new Error('source_corpus_topology_review_required_argument_missing');
  const workspaceRoot = process.cwd();
  const draft = buildReviewDraft({
    reconciliation: JSON.parse(fs.readFileSync(workspaceInput(workspaceRoot, args.reconciliation), 'utf8')),
    databaseInventory: JSON.parse(fs.readFileSync(workspaceInput(workspaceRoot, args['db-inventory']), 'utf8')),
    dumpAudit: JSON.parse(fs.readFileSync(workspaceInput(workspaceRoot, args['dump-audit']), 'utf8')),
    environmentId: args['environment-id'],
    topologySnapshotId: args['snapshot-id'],
    capturedAt: args['captured-at']
  });
  const outputDirectory = newWorkspaceDirectory(workspaceRoot, args['out-dir']);
  fs.mkdirSync(outputDirectory, { recursive: false });
  const files = [
    ['topology-evidence.draft.json', draft.topologyEvidence],
    ['review-response-template.json', draft.reviewTemplate],
    ['manifest.json', draft.manifest]
  ];
  for (const [name, value] of files) {
    fs.writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  }
  return {
    ...draft.manifest,
    outputDirectory,
    writtenFiles: files.map(([name]) => name)
  };
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

module.exports = { MODE, payloadValid, validateInputs, buildReviewDraft, preflight, runSelfTest };
