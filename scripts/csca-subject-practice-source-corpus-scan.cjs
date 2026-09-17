#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { isAbsolute, relative, resolve, sep } = require('node:path');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
  buildSubjectPracticeSourceCorpusInventoryManifest,
  buildSubjectPracticeSourceCorpusScanEvidence,
  createSubjectPracticeSourceCorpusScanAttestation,
  scanSubjectPracticeContentAgainstSourceCorpus,
  subjectPracticeSourceCorpusScanEvidenceQualifies,
  verifySubjectPracticeSourceCorpusScanAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');

const MODE = 'subject_practice_source_corpus_local_scan_v1';
const SECRET_ENV = 'CSCA_SOURCE_CORPUS_SCANNER_HMAC_SECRET';

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

function workspacePath(value, options = {}) {
  const root = resolve(options.workspaceRoot ?? process.cwd());
  const target = resolve(root, String(value ?? '').trim());
  const rel = relative(root, target);
  if (!String(value ?? '').trim() || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('source_corpus_scan_path_must_be_inside_workspace');
  }
  if (options.mustExist && !existsSync(target)) throw new Error('source_corpus_scan_input_missing');
  if (options.mustBeNew && existsSync(target)) throw new Error('source_corpus_scan_refuses_to_overwrite');
  if (!target.toLowerCase().endsWith('.json')) throw new Error('source_corpus_scan_path_must_be_json');
  return target;
}

function text(value) {
  return String(value ?? '').trim();
}

function stringsFrom(value, path = 'target', output = []) {
  if (typeof value === 'string' && text(value)) output.push({ field: path, text: value });
  else if (Array.isArray(value)) value.forEach((entry, index) => stringsFrom(entry, `${path}[${index}]`, output));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => stringsFrom(entry, `${path}.${key}`, output));
  }
  return output;
}

function targetFieldsFor(layer, target) {
  if (layer === 'profile_asset_admission') {
    return [{ field: 'approved_profile_asset', text: JSON.stringify(target.approved_profile_asset ?? target) }];
  }
  if (layer === 'generator_projection') {
    return [
      { field: 'system', text: text(target.system) },
      { field: 'user', text: text(target.user) }
    ].filter((entry) => entry.text);
  }
  return [
    { field: 'candidate_prompt', text: text(target.candidate_prompt ?? target.prompt) },
    { field: 'candidate_options', text: JSON.stringify(target.candidate_options ?? target.options ?? []) }
  ].filter((entry) => entry.text);
}

function localSourceFiles(workspaceRoot = process.cwd()) {
  const docsDir = resolve(workspaceRoot, 'docs');
  return readdirSync(docsDir)
    .filter((name) => /-source\.json$/i.test(name) && name !== 'csca-past-paper-source-json-template.json')
    .map((name) => resolve(docsDir, name))
    .sort();
}

function sourceQuestionFields(question) {
  return stringsFrom({
    prompt: question.prompt ?? question.promptText,
    options: question.options,
    answer: question.correctAnswer ?? question.answer,
    explanation: question.explanation,
    localizations: question.localizations
  }, 'source').map((entry) => entry.text).filter(Boolean);
}

function buildLocalCorpus(workspaceRoot = process.cwd()) {
  const files = localSourceFiles(workspaceRoot);
  const entries = [];
  const structuredRevisions = [];
  const inventory = [];
  const subjectCounts = {};
  const languageCounts = {};
  let questionCount = 0;
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const document = parsed.document ?? {};
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const subject = text(document.subject).toLowerCase() || 'unknown';
    const language = text(document.language).toLowerCase() || 'unknown';
    const included = document.usagePolicy?.allowSimilarityCheck !== false;
    const fileQuestions = included ? questions : [];
    const fileSha256 = sha256(raw);
    const documentIdentityHash = text(document.sourceHash) || sha256(JSON.stringify(canonicalJsonValue({
      subject, language, sourceType: document.sourceType, title: document.title,
      examYear: document.examYear, examSession: document.examSession, sourceLabel: document.sourceLabel
    })));
    const fileEntries = fileQuestions.flatMap(sourceQuestionFields);
    for (const sourceText of fileEntries) entries.push(sourceText);
    fileQuestions.forEach((question, index) => structuredRevisions.push(
      buildSubjectPracticeStructuredSourceQuestionRevision({
        sourceSystem: 'local_file',
        documentId: relative(workspaceRoot, file).replace(/\\/g, '/'),
        questionOrdinal: text(question.questionNumber) || String(index + 1),
        subject,
        language,
        prompt: question.prompt ?? question.promptText,
        options: question.options,
        answer: question.correctAnswer ?? question.answer,
        explanation: question.explanation,
        localizations: question.localizations,
        documentIdentityHash
      })
    ));
    questionCount += fileQuestions.length;
    subjectCounts[subject] = (subjectCounts[subject] ?? 0) + fileQuestions.length;
    languageCounts[language] = (languageCounts[language] ?? 0) + fileQuestions.length;
    inventory.push({
      path: relative(workspaceRoot, file).replace(/\\/g, '/'),
      fileSha256,
      declaredSourceHash: text(document.sourceHash) || null,
      sourceType: text(document.sourceType) || 'unknown',
      subject,
      language,
      included,
      questionCount: fileQuestions.length,
      scanFieldCount: fileEntries.length
    });
  }
  const localManifest = {
    corpusBuilderVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_BUILDER_VERSION,
    coverageStatus: 'partial',
    coverageReason: 'local_repository_docs_only_not_proven_complete_against_database_and_remote_sources',
    corpusFieldCoverage: { prompt: true, options: true, answer: true, explanation: true, localizations: true },
    subjectCounts,
    languageCounts,
    questionCount,
    scanFieldCount: entries.length,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    structuredRevisionCount: structuredRevisions.length,
    structuredRevisionSetSha256: sha256(JSON.stringify(structuredRevisions.map((revision) => [
      revision.sourceQuestionRevisionId, revision.lineageHash, revision.fieldHashes.rawContentSha256
    ]))),
    inventory
  };
  const controlledInventoryManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: [
      'local_repository_source_json',
      'production_csca_source_questions',
      'remote_synced_source_inventory'
    ],
    sources: [
      {
        sourceId: 'local_repository_source_json',
        kind: 'local_file',
        locatorFingerprintSha256: sha256(JSON.stringify(inventory.map((entry) => entry.path))),
        expectedCount: questionCount,
        observedCount: questionCount,
        highWatermark: snapshotHighWatermark(inventory),
        updatedAt: new Date(0).toISOString(),
        extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
        status: 'complete'
      },
      {
        sourceId: 'production_csca_source_questions',
        kind: 'database_query',
        locatorFingerprintSha256: sha256('production:csca_questions:source-exam-reference-filter-v1'),
        expectedCount: 0,
        observedCount: 0,
        highWatermark: 'not_queried_in_local_preflight',
        updatedAt: new Date(0).toISOString(),
        extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
        status: 'failed'
      },
      {
        sourceId: 'remote_synced_source_inventory',
        kind: 'remote_sync',
        locatorFingerprintSha256: sha256('remote:system-known-source-inventory-v1'),
        expectedCount: 0,
        observedCount: 0,
        highWatermark: 'not_synced_in_local_preflight',
        updatedAt: new Date(0).toISOString(),
        extractedFields: ['prompt', 'options', 'answer', 'explanation', 'localizations'],
        status: 'failed'
      }
    ]
  });
  const snapshotSha256 = sha256(JSON.stringify(canonicalJsonValue({
    manifest: localManifest,
    controlledInventoryManifest,
    entrySha256: entries.map((entry) => sha256(entry)),
    structuredRevisionSetSha256: localManifest.structuredRevisionSetSha256
  })));
  return {
    manifest: localManifest,
    controlledInventoryManifest,
    entries,
    structuredRevisions,
    snapshotSha256,
    snapshotId: `local-partial-${snapshotSha256.slice(0, 16)}`
  };
}

function snapshotHighWatermark(inventory) {
  return sha256(JSON.stringify(inventory.map((entry) => [entry.path, entry.fileSha256])));
}

function preflight(input = {}) {
  const corpus = buildLocalCorpus(input.workspaceRoot);
  return {
    mode: MODE,
    status: 'preflight_only_no_scan_or_output',
    corpusSnapshotId: corpus.snapshotId,
    corpusSnapshotSha256: corpus.snapshotSha256,
    corpusEntryCount: corpus.manifest.questionCount,
    scanFieldCount: corpus.manifest.scanFieldCount,
    corpusCoverageStatus: corpus.manifest.coverageStatus,
    coverageReason: corpus.manifest.coverageReason,
    sourceFileCount: corpus.manifest.inventory.length,
    inventoryManifestSha256: corpus.controlledInventoryManifest.manifestSha256,
    inventoryCoverageStatus: corpus.controlledInventoryManifest.coverageStatus,
    inventoryReasonCodes: corpus.controlledInventoryManifest.reasonCodes,
    inventorySources: corpus.controlledInventoryManifest.sources.map((source) => ({
      sourceId: source.sourceId,
      kind: source.kind,
      status: source.status,
      expectedCount: source.expectedCount,
      observedCount: source.observedCount,
      highWatermark: source.highWatermark
    })),
    subjectCounts: corpus.manifest.subjectCounts,
    languageCounts: corpus.manifest.languageCounts,
    hmacSecretConfigured: text(process.env[SECRET_ENV]).length >= 32,
    formalReleaseEligible: false,
    formalReleaseReason: 'local_repository_corpus_is_partial',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_local_files_only',
    productionImpact: 'none_preflight_only'
  };
}

function execute(input) {
  const subject = text(input.subject).toLowerCase();
  if (!['math', 'physics', 'chemistry'].includes(subject)) throw new Error('source_corpus_scan_subject_invalid');
  const layer = text(input.layer);
  if (!['profile_asset_admission', 'generator_projection', 'candidate_output'].includes(layer)) throw new Error('source_corpus_scan_layer_invalid');
  const targetPath = workspacePath(input.target, { mustExist: true });
  const outputPath = workspacePath(input.out, { mustBeNew: true });
  const secret = text(process.env[SECRET_ENV]);
  if (secret.length < 32) throw new Error('source_corpus_scan_hmac_secret_missing_or_too_short');
  const target = JSON.parse(readFileSync(targetPath, 'utf8'));
  const targetFields = targetFieldsFor(layer, target);
  if (!targetFields.length) throw new Error('source_corpus_scan_target_has_no_text');
  const corpus = buildLocalCorpus();
  const metrics = scanSubjectPracticeContentAgainstSourceCorpus({ targetFields, sourceTexts: corpus.entries });
  const targetContentSha256 = sha256(JSON.stringify(canonicalJsonValue(target)));
  const scannedAt = new Date().toISOString();
  const evidence = buildSubjectPracticeSourceCorpusScanEvidence({
    layer,
    subject,
    targetContentSha256,
    providerProjectionSha256: layer === 'generator_projection' ? targetContentSha256 : null,
    sourceCorpusSnapshotId: corpus.snapshotId,
    sourceCorpusSnapshotSha256: corpus.snapshotSha256,
    sourceCorpusEntryCount: corpus.manifest.questionCount,
    corpusCoverageStatus: 'partial',
    inventoryManifestSha256: corpus.controlledInventoryManifest.manifestSha256,
    corpusFieldCoverage: corpus.manifest.corpusFieldCoverage,
    corpusSubjectCounts: corpus.manifest.subjectCounts,
    corpusLanguageCounts: corpus.manifest.languageCounts,
    targetFieldNames: targetFields.map((entry) => entry.field),
    requiredLanguages: Object.keys(corpus.manifest.languageCounts).filter((language) => language !== 'unknown'),
    thresholdCalibrationStatus: 'fixture_only',
    ...metrics,
    scannedAt
  });
  const scannerId = text(process.env.CSCA_SOURCE_CORPUS_SCANNER_ID) || 'local-repository-partial-scanner-v1';
  const keyId = text(process.env.CSCA_SOURCE_CORPUS_SCANNER_KEY_ID) || 'local-partial-key-v1';
  const expiresAt = new Date(Date.parse(scannedAt) + 24 * 60 * 60 * 1000).toISOString();
  const attestation = createSubjectPracticeSourceCorpusScanAttestation({
    evidence, scannerId, keyId, issuedAt: scannedAt, expiresAt, secret
  });
  const proof = verifySubjectPracticeSourceCorpusScanAttestation({
    evidence, attestation, secret, allowedScannerIds: [scannerId], allowedKeyIds: [keyId], now: scannedAt
  });
  if (!proof) throw new Error('source_corpus_scan_attestation_self_verification_failed');
  const formalReleaseEligible = subjectPracticeSourceCorpusScanEvidenceQualifies({
    evidence, trustedProof: proof,
    expectedTargetContentSha256: targetContentSha256,
    expectedSourceCorpusSnapshotSha256: corpus.snapshotSha256,
    expectedInventoryManifestSha256: corpus.controlledInventoryManifest.manifestSha256
  });
  const artifact = {
    mode: MODE,
    generatedAt: scannedAt,
    corpusManifest: corpus.manifest,
    controlledInventoryManifest: corpus.controlledInventoryManifest,
    evidence,
    attestation,
    formalReleaseEligible,
    formalReleaseReason: formalReleaseEligible ? null : 'local_repository_corpus_is_partial',
    secretSerialized: false,
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_local_files_only',
    productionImpact: 'none_evidence_only_not_connected_to_release_gate'
  };
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...artifact, outputPath };
}

function selfTest() {
  const report = preflight();
  const checks = {
    localCorpusDiscovered: report.sourceFileCount > 0 && report.corpusEntryCount > 0,
    localCorpusCannotClaimCompleteness: report.corpusCoverageStatus === 'partial' && !report.formalReleaseEligible,
    snapshotIsContentBound: /^[a-f0-9]{64}$/.test(report.corpusSnapshotSha256)
      && /^[a-f0-9]{64}$/.test(report.inventoryManifestSha256),
    missingDatabaseAndRemoteSourcesAreExplicit: report.inventoryCoverageStatus === 'partial'
      && report.inventoryReasonCodes.includes('source_corpus_inventory_source_failed')
  };
  return {
    mode: `${MODE}_self_test`,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    preflight: report
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['self-test']) return selfTest();
  if (!args.execute) return preflight();
  return execute({ subject: args.subject, layer: args.layer, target: args.target, out: args.out });
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

module.exports = { argsFrom, workspacePath, buildLocalCorpus, preflight, execute, selfTest };
