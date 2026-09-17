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
const { loadEnv } = require('./load-env.cjs');
const {
  normalizeSubjectPracticeSourceCorpusText
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
  buildSubjectPracticeStructuredSourceQuestionRevision,
  subjectPracticeStructuredSourceQuestionRevisionValid
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  createSubjectPracticeCommonFragmentCorpusQualification
} = require('../backend/src/ai-questioning/subject-practice-common-fragment-corpus-policy');
const {
  verifySubjectPracticeSourceCorpusTopologyAttestation
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-topology-policy');
const {
  buildQualifiedInventory,
  fixture: qualifiedInventoryFixture
} = require('./csca-subject-practice-source-corpus-topology-qualified-inventory.cjs');
const {
  MATERIALIZATION_VERSION,
  materializeConflictResolution,
  fixtureEvidence: conflictResolutionFixture
} = require('./csca-subject-practice-source-corpus-conflict-resolution-materialize.cjs');
const {
  buildLocalCorpus
} = require('./csca-subject-practice-source-corpus-scan.cjs');
const {
  documentKey
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');

loadEnv();

const MODE = 'subject_practice_source_corpus_structured_rebuild_v3';
const SCHEMA_VERSION = 'subject-practice-source-corpus-structured-rebuild-v3';
const SOURCE_FIELDS = Object.freeze(['prompt', 'options', 'answer', 'explanation', 'localizations']);

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
  const serialized = typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function materializerSha256(value) {
  return crypto.createHash('sha256').update(
    typeof value === 'string' ? value : JSON.stringify(value)
  ).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.from(new Set(text(value).split(',').map((entry) => entry.trim()).filter(Boolean)));
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

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target))
    || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_structured_rebuild_workspace_json_path_invalid');
  }
  return target;
}

function readWorkspaceJson(workspaceRoot, value) {
  return JSON.parse(fs.readFileSync(
    workspaceJsonPath(workspaceRoot, value, { mustExist: true }), 'utf8'
  ));
}

function recordKey(record) {
  return `${text(record.documentIdentity).toLowerCase()}|${text(record.questionNumber)}`;
}

function sourceDocumentFamilyIdentity(document) {
  const explicit = text(document.documentFamilyId ?? document.sourceFamilyId);
  if (explicit) return explicit.toLowerCase();
  return [document.subject, document.sourceType, document.examYear ?? '', document.examSession ?? '']
    .map((value) => text(value).toLowerCase()).join('|');
}

function sourceDocumentFamilyIdentityBasis(document) {
  return text(document.documentFamilyId ?? document.sourceFamilyId)
    ? 'explicit_source_family_id'
    : 'legacy_subject_type_year_session_fallback';
}

function normalizedField(value) {
  return normalizeSubjectPracticeSourceCorpusText(
    typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value))
  );
}

function fieldsFor(record) {
  const fields = record.fields ?? {};
  return {
    prompt: text(fields.prompt),
    options: canonicalJsonValue(fields.options ?? []),
    answer: text(fields.answer),
    explanation: text(fields.explanation),
    localizations: canonicalJsonValue(fields.localizations ?? {})
  };
}

function contentConflict(left, right) {
  const leftFields = fieldsFor(left);
  const rightFields = fieldsFor(right);
  return SOURCE_FIELDS.some((field) => normalizedField(leftFields[field]) !== normalizedField(rightFields[field]));
}

function validateRecordSet(records, sourceSystem) {
  if (!Array.isArray(records)) throw new Error('source_corpus_structured_rebuild_record_set_invalid');
  const keys = new Set();
  const identitiesByScopedFamily = new Map();
  for (const record of records) {
    const key = recordKey(record);
    if (!text(record.documentIdentity) || !text(record.documentFamilyIdentity) || !text(record.questionNumber)
      || record.sourceSystem !== sourceSystem || keys.has(key)) {
      throw new Error('source_corpus_structured_rebuild_record_invalid_or_duplicate');
    }
    keys.add(key);
    const scopedFamily = [record.subject, record.language, record.documentFamilyIdentity]
      .map((value) => text(value).toLowerCase()).join('|');
    const identities = identitiesByScopedFamily.get(scopedFamily) ?? new Set();
    identities.add(text(record.documentIdentity).toLowerCase());
    identitiesByScopedFamily.set(scopedFamily, identities);
  }
  if (Array.from(identitiesByScopedFamily.values()).some((identities) => identities.size > 1)) {
    throw new Error('source_corpus_structured_rebuild_document_family_ambiguous');
  }
}

function validateOverlayArtifact({ overlayArtifact, qualifiedInventory, localSourceSetSha256 }) {
  if (!overlayArtifact || overlayArtifact.materializationManifest?.materializationVersion !== MATERIALIZATION_VERSION
    || overlayArtifact.overlay?.materializationVersion !== MATERIALIZATION_VERSION
    || overlayArtifact.materializationManifest.status
      !== 'resolution_overlay_ready_for_separate_corpus_rebuild_validation'
    || overlayArtifact.materializationManifest.formalReleaseEligible !== false
    || overlayArtifact.materializationManifest.overlaySha256
      !== materializerSha256(overlayArtifact.overlay)
    || overlayArtifact.artifactSha256 !== materializerSha256({
      materializationManifest: overlayArtifact.materializationManifest,
      overlay: overlayArtifact.overlay
    })
    || overlayArtifact.overlay.sourceDatabaseInventoryPayloadSha256
      !== qualifiedInventory.databaseInventoryPayloadSha256
    || overlayArtifact.overlay.sourceLocalSetSha256 !== localSourceSetSha256
    || overlayArtifact.materializationManifest.entryCount !== overlayArtifact.overlay.entries?.length) {
    throw new Error('source_corpus_structured_rebuild_resolution_overlay_invalid_or_stale');
  }
  return overlayArtifact.overlay;
}

function resolvedFieldsFor(entry, localRecord, databaseRecord) {
  if (entry.resolution === 'exclude_from_complete_corpus') {
    if (entry.resolvedRevision !== null || entry.excludedFromCompleteCorpus !== true) {
      throw new Error('source_corpus_structured_rebuild_exclusion_invalid');
    }
    return null;
  }
  const resolved = entry.resolvedRevision;
  if (!resolved || entry.excludedFromCompleteCorpus !== false
    || entry.resolvedRevisionSha256 !== materializerSha256(resolved)) {
    throw new Error('source_corpus_structured_rebuild_resolved_revision_invalid');
  }
  const localFields = fieldsFor(localRecord);
  const databaseFields = fieldsFor(databaseRecord);
  if (entry.resolution === 'use_local'
    && JSON.stringify(resolved) !== JSON.stringify(localFields)) {
    throw new Error('source_corpus_structured_rebuild_local_resolution_mismatch');
  }
  if (entry.resolution === 'use_database'
    && JSON.stringify(resolved) !== JSON.stringify(databaseFields)) {
    throw new Error('source_corpus_structured_rebuild_database_resolution_mismatch');
  }
  if (entry.resolution === 'field_by_field'
    && SOURCE_FIELDS.some((field) => JSON.stringify(resolved[field]) !== JSON.stringify(localFields[field])
      && JSON.stringify(resolved[field]) !== JSON.stringify(databaseFields[field]))) {
    throw new Error('source_corpus_structured_rebuild_field_resolution_not_from_bound_source');
  }
  if (!['use_local', 'use_database', 'field_by_field'].includes(entry.resolution)) {
    throw new Error('source_corpus_structured_rebuild_resolution_unknown');
  }
  return canonicalJsonValue(resolved);
}

function rebuiltRevision({ key, localRecord, databaseRecord, fields, resolution }) {
  const [documentIdentity, questionNumber] = [
    localRecord?.documentIdentity ?? databaseRecord.documentIdentity,
    localRecord?.questionNumber ?? databaseRecord.questionNumber
  ];
  const sourceBindings = [localRecord, databaseRecord].filter(Boolean).map((record) => ({
    sourceSystem: record.sourceSystem,
    sourceDocumentId: text(record.sourceDocumentId),
    sourceQuestionId: text(record.sourceQuestionId)
  })).sort((left, right) => left.sourceSystem.localeCompare(right.sourceSystem));
  const body = {
    revisionKey: key,
    documentIdentity,
    documentFamilyIdentity: localRecord?.documentFamilyIdentity ?? databaseRecord.documentFamilyIdentity,
    questionNumber,
    subject: text(localRecord?.subject ?? databaseRecord.subject).toLowerCase(),
    language: text(localRecord?.language ?? databaseRecord.language).toLowerCase(),
    fields: canonicalJsonValue(fields),
    sourceBindings,
    resolution
  };
  return { ...body, revisionSha256: sha256(body) };
}

function formalStructuredRevision(record, fields) {
  return buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: record.sourceSystem === 'database_query' ? 'production_database' : 'local_file',
    documentId: text(record.sourceDocumentId),
    questionOrdinal: text(record.questionNumber),
    subject: record.subject,
    language: record.language,
    prompt: fields.prompt,
    options: fields.options,
    answer: fields.answer,
    explanation: fields.explanation,
    localizations: fields.localizations,
    documentIdentityHash: sha256(text(record.documentFamilyIdentity).toLowerCase()),
    canonicalTaskParameterFingerprint: null
  });
}

function rebuildStructuredCorpus(input) {
  const qualifiedInventory = buildQualifiedInventory(input.qualifiedInventoryInput);
  if (qualifiedInventory.inventoryManifest.coverageStatus !== 'all_system_known_source_exam_reference'
    || qualifiedInventory.topologyQualificationVerified !== true) {
    throw new Error('source_corpus_structured_rebuild_inventory_not_topology_qualified');
  }
  validateRecordSet(input.localRecords, 'local_file');
  validateRecordSet(input.databaseRecords, 'database_query');
  const inventorySources = new Map(qualifiedInventory.inventoryManifest.sources
    .map((source) => [source.sourceId, source]));
  if (inventorySources.get('local_repository_source_json')?.observedCount !== input.localRecords.length
    || inventorySources.get('production_csca_source_questions')?.observedCount !== input.databaseRecords.length) {
    throw new Error('source_corpus_structured_rebuild_source_count_mismatch');
  }
  const localByKey = new Map(input.localRecords.map((record) => [recordKey(record), record]));
  const databaseByKey = new Map(input.databaseRecords.map((record) => [recordKey(record), record]));
  const allKeys = Array.from(new Set([...localByKey.keys(), ...databaseByKey.keys()])).sort();
  const conflictKeys = allKeys.filter((key) => localByKey.has(key) && databaseByKey.has(key)
    && contentConflict(localByKey.get(key), databaseByKey.get(key)));
  if (conflictKeys.length !== qualifiedInventory.unresolvedConflictCount) {
    throw new Error('source_corpus_structured_rebuild_conflict_count_mismatch');
  }
  let overlay = null;
  if (conflictKeys.length) {
    overlay = validateOverlayArtifact({
      overlayArtifact: input.overlayArtifact,
      qualifiedInventory,
      localSourceSetSha256: input.localSourceSetSha256
    });
  } else if (input.overlayArtifact) {
    throw new Error('source_corpus_structured_rebuild_unexpected_overlay');
  }
  const overlayByKey = new Map();
  for (const entry of overlay?.entries ?? []) {
    const key = `${text(entry.documentIdentity).toLowerCase()}|${text(entry.questionNumber)}`;
    if (overlayByKey.has(key)) throw new Error('source_corpus_structured_rebuild_duplicate_overlay_entry');
    overlayByKey.set(key, entry);
  }
  if (overlayByKey.size !== conflictKeys.length
    || conflictKeys.some((key) => !overlayByKey.has(key))
    || Array.from(overlayByKey.keys()).some((key) => !conflictKeys.includes(key))) {
    throw new Error('source_corpus_structured_rebuild_overlay_conflict_set_mismatch');
  }
  const revisions = [];
  const structuredRevisions = [];
  let excludedConflictCount = 0;
  for (const key of allKeys) {
    const localRecord = localByKey.get(key);
    const databaseRecord = databaseByKey.get(key);
    if (localRecord && databaseRecord && contentConflict(localRecord, databaseRecord)) {
      const entry = overlayByKey.get(key);
      const fields = resolvedFieldsFor(entry, localRecord, databaseRecord);
      if (!fields) { excludedConflictCount += 1; continue; }
      revisions.push(rebuiltRevision({
        key, localRecord, databaseRecord, fields,
        resolution: `human_${entry.resolution}`
      }));
      structuredRevisions.push(
        formalStructuredRevision(localRecord, fields),
        formalStructuredRevision(databaseRecord, fields)
      );
      continue;
    }
    const canonicalFields = fieldsFor(localRecord ?? databaseRecord);
    revisions.push(rebuiltRevision({
      key, localRecord, databaseRecord,
      fields: canonicalFields,
      resolution: localRecord && databaseRecord
        ? 'normalized_equivalent_independent_sources'
        : localRecord ? 'local_only_topology_included' : 'database_only_topology_included'
    }));
    if (localRecord) structuredRevisions.push(formalStructuredRevision(localRecord, canonicalFields));
    if (databaseRecord) structuredRevisions.push(formalStructuredRevision(databaseRecord, canonicalFields));
  }
  const revisionSetSha256 = sha256(revisions.map((revision) => [
    revision.revisionKey, revision.revisionSha256
  ]));
  if (structuredRevisions.some((revision) => !subjectPracticeStructuredSourceQuestionRevisionValid(revision))) {
    throw new Error('source_corpus_structured_rebuild_formal_revision_invalid');
  }
  structuredRevisions.sort((left, right) =>
    left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  const structuredRevisionSetSha256 = sha256(structuredRevisions);
  const completeStructuredCorpusRebuilt = excludedConflictCount === 0
    && structuredRevisions.length === input.localRecords.length + input.databaseRecords.length;
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: completeStructuredCorpusRebuilt
      ? 'complete_structured_corpus_rebuilt_pending_calibration_and_scanner_attestation'
      : 'structured_corpus_incomplete_excluded_revision_requires_inventory_reissue',
    topologyQualifiedInventoryPayloadSha256: qualifiedInventory.payloadSha256,
    inventoryManifestSha256: qualifiedInventory.inventoryManifest.manifestSha256,
    inventoryManifest: qualifiedInventory.inventoryManifest,
    resolutionOverlaySha256: overlay ? input.overlayArtifact.materializationManifest.overlaySha256 : null,
    sourceCounts: {
      local: input.localRecords.length,
      database: input.databaseRecords.length,
      logicalUnion: allKeys.length
    },
    contentConflictCount: conflictKeys.length,
    resolvedConflictCount: conflictKeys.length - excludedConflictCount,
    excludedConflictCount,
    revisionCount: revisions.length,
    revisionSetSha256,
    revisions,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    structuredRevisionCount: structuredRevisions.length,
    structuredRevisionSetSha256,
    structuredRevisions,
    completeStructuredCorpusRebuilt,
    unresolvedConflictCount: 0,
    requiresInventoryReissue: excludedConflictCount > 0,
    requiresThresholdCalibration: true,
    requiresScannerAttestation: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_validated_artifacts_only',
    publicationImpact: 'none_rebuilt_corpus_is_not_student_content'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function fixtureRecord(sourceSystem, fields) {
  return {
    documentIdentity: 'math|fixture|en', questionNumber: '1', subject: 'math', language: 'en',
    documentFamilyIdentity: 'math|past_paper|2026|fixture',
    sourceSystem, sourceDocumentId: sourceSystem === 'local_file' ? 'docs/fixture.json' : '1',
    sourceQuestionId: sourceSystem === 'local_file' ? '1' : '2', fields
  };
}

function sourceFields(question) {
  return {
    prompt: text(question.promptText ?? question.prompt),
    options: canonicalJsonValue(question.options ?? []),
    answer: text(question.correctAnswer ?? question.answer),
    explanation: text(question.explanation),
    localizations: canonicalJsonValue(question.localizations ?? {})
  };
}

function localRecordsFromWorkspace(workspaceRoot) {
  const docsDirectory = path.resolve(workspaceRoot, 'docs');
  const documents = fs.readdirSync(docsDirectory).filter((name) => /-source\.json$/i.test(name)
    && name !== 'csca-past-paper-source-json-template.json').sort().map((name) => {
      const absolute = path.join(docsDirectory, name);
      const raw = fs.readFileSync(absolute, 'utf8');
      const parsed = JSON.parse(raw);
      const relativeFile = `docs/${name}`;
      const documentIdentity = documentKey(parsed.document ?? {});
      const documentFamilyIdentity = sourceDocumentFamilyIdentity(parsed.document ?? {});
      const subject = text(parsed.document?.subject).toLowerCase();
      const language = text(parsed.document?.language).toLowerCase();
      const records = (parsed.questions ?? []).map((question, index) => {
        const questionNumber = text(question.questionNumber) || String(index + 1);
        return {
          documentIdentity, documentFamilyIdentity,
          documentFamilyIdentityBasis: sourceDocumentFamilyIdentityBasis(parsed.document ?? {}),
          questionNumber, subject, language,
          sourceSystem: 'local_file', sourceDocumentId: relativeFile,
          sourceQuestionId: `${relativeFile}#${questionNumber}`,
          fields: sourceFields(question)
        };
      });
      return { relativeFile, fileSha256: sha256(raw), records };
    });
  return {
    records: documents.flatMap((document) => document.records),
    sourceSetSha256: sha256(documents.map((document) => [document.relativeFile, document.fileSha256]))
  };
}

function databaseRecordsFromInventory(databaseInventory) {
  const questionsByDocumentId = new Map();
  for (const question of databaseInventory.sourceQuestions ?? []) {
    const id = Number(question.documentId);
    const records = questionsByDocumentId.get(id) ?? [];
    records.push(question);
    questionsByDocumentId.set(id, records);
  }
  return (databaseInventory.documents ?? []).flatMap((document) => {
    const documentIdentity = documentKey(document);
    const documentFamilyIdentity = sourceDocumentFamilyIdentity(document);
    return (questionsByDocumentId.get(Number(document.id)) ?? []).map((question) => ({
      documentIdentity,
      documentFamilyIdentity,
      documentFamilyIdentityBasis: sourceDocumentFamilyIdentityBasis(document),
      questionNumber: text(question.questionNumber),
      subject: text(question.subject ?? document.subject).toLowerCase(),
      language: text(question.language ?? document.language).toLowerCase(),
      sourceSystem: 'database_query',
      sourceDocumentId: String(document.id),
      sourceQuestionId: String(question.id),
      fields: sourceFields(question)
    }));
  });
}

function sealedOverlay(decision) {
  const materialized = materializeConflictResolution(conflictResolutionFixture(decision));
  return {
    ...materialized,
    artifactSha256: materializerSha256(materialized)
  };
}

function testInput(decision = 'use_local') {
  const qualifiedInventoryInput = qualifiedInventoryFixture({ contentConflictCount: 1 });
  const sourceLocalSetSha256 = sha256('fixture-local-source-set');
  const overlayArtifact = sealedOverlay(decision);
  overlayArtifact.overlay.sourceDatabaseInventoryPayloadSha256 = qualifiedInventoryInput.databaseInventory.payloadSha256;
  overlayArtifact.overlay.sourceLocalSetSha256 = sourceLocalSetSha256;
  overlayArtifact.materializationManifest.overlaySha256 = materializerSha256(overlayArtifact.overlay);
  overlayArtifact.artifactSha256 = materializerSha256({
    materializationManifest: overlayArtifact.materializationManifest,
    overlay: overlayArtifact.overlay
  });
  const evidence = conflictResolutionFixture(decision);
  return {
    qualifiedInventoryInput,
    localSourceSetSha256: sourceLocalSetSha256,
    overlayArtifact,
    localRecords: [fixtureRecord('local_file', evidence.reviewPacket.conflicts[0].localRevisionContext)],
    databaseRecords: [fixtureRecord('database_query', evidence.reviewPacket.conflicts[0].databaseRevisionContext)]
  };
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

function preflight(env = process.env) {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    requiredInputs: [
      'current_topology_attestation_and_evidence', 'current_reconciliation',
      'current_database_inventory', 'complete_human_conflict_resolution_overlay'
    ],
    topologySecretConfigured: text(env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET).length >= 32,
    reviewerAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS).length > 0,
    keyAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS).length > 0,
    outputPolicy: 'new_json_file_inside_workspace_no_overwrite',
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function execute(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const secret = text(process.env.CSCA_SOURCE_CORPUS_TOPOLOGY_HMAC_SECRET);
  const allowedReviewerIds = list(process.env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_REVIEWER_IDS);
  const allowedKeyIds = list(process.env.CSCA_SOURCE_CORPUS_TOPOLOGY_ALLOWED_KEY_IDS);
  if (secret.length < 32 || !allowedReviewerIds.length || !allowedKeyIds.length) {
    throw new Error('source_corpus_structured_rebuild_topology_verification_config_missing');
  }
  const databaseInventory = readWorkspaceJson(workspaceRoot, input.dbInventory);
  const local = localRecordsFromWorkspace(workspaceRoot);
  const rebuilt = rebuildStructuredCorpus({
    qualifiedInventoryInput: {
      evidence: readWorkspaceJson(workspaceRoot, input.evidence),
      issueArtifact: readWorkspaceJson(workspaceRoot, input.issue),
      reconciliation: readWorkspaceJson(workspaceRoot, input.reconciliation),
      databaseInventory,
      secret,
      allowedReviewerIds,
      allowedKeyIds,
      now: input.now,
      currentLocalCorpusSnapshotSha256: buildLocalCorpus(workspaceRoot).snapshotSha256
    },
    localSourceSetSha256: local.sourceSetSha256,
    localRecords: local.records,
    databaseRecords: databaseRecordsFromInventory(databaseInventory),
    overlayArtifact: readWorkspaceJson(workspaceRoot, input.overlay)
  });
  const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(rebuilt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return {
    mode: MODE,
    status: rebuilt.status,
    outputPath,
    payloadSha256: rebuilt.payloadSha256,
    revisionCount: rebuilt.revisionCount,
    resolvedConflictCount: rebuilt.resolvedConflictCount,
    excludedConflictCount: rebuilt.excludedConflictCount,
    formalReleaseEligible: false,
    providerImpact: rebuilt.providerImpact,
    databaseImpact: rebuilt.databaseImpact,
    publicationImpact: rebuilt.publicationImpact
  };
}

function runSelfTest() {
  const localInput = testInput('use_local');
  const local = rebuildStructuredCorpus(localInput);
  const database = rebuildStructuredCorpus(testInput('use_database'));
  const excluded = rebuildStructuredCorpus(testInput('exclude_from_complete_corpus'));
  const topologyQualification = verifySubjectPracticeSourceCorpusTopologyAttestation({
    evidence: localInput.qualifiedInventoryInput.evidence,
    attestation: localInput.qualifiedInventoryInput.issueArtifact.attestation,
    secret: localInput.qualifiedInventoryInput.secret,
    allowedReviewerIds: localInput.qualifiedInventoryInput.allowedReviewerIds,
    allowedKeyIds: localInput.qualifiedInventoryInput.allowedKeyIds,
    now: localInput.qualifiedInventoryInput.now
  });
  const downstreamCorpusQualification = createSubjectPracticeCommonFragmentCorpusQualification({
    inventoryManifest: local.inventoryManifest,
    sourceRevisions: local.structuredRevisions,
    topology: {
      qualification: topologyQualification,
      expectedEvidencePayloadSha256: localInput.qualifiedInventoryInput.evidence.payloadSha256,
      expectedEnvironmentId: localInput.qualifiedInventoryInput.evidence.environmentId,
      now: localInput.qualifiedInventoryInput.now
    }
  });
  const tamperedOverlay = testInput('use_local');
  tamperedOverlay.overlayArtifact.overlay.entries[0].resolvedRevision.answer = 'tampered';
  const staleInventory = testInput('use_local');
  staleInventory.qualifiedInventoryInput.currentLocalCorpusSnapshotSha256 = sha256('stale');
  const incompleteOverlay = testInput('use_local');
  incompleteOverlay.overlayArtifact.overlay.entries = [];
  incompleteOverlay.overlayArtifact.materializationManifest.entryCount = 0;
  incompleteOverlay.overlayArtifact.materializationManifest.overlaySha256 = materializerSha256(incompleteOverlay.overlayArtifact.overlay);
  incompleteOverlay.overlayArtifact.artifactSha256 = materializerSha256({
    materializationManifest: incompleteOverlay.overlayArtifact.materializationManifest,
    overlay: incompleteOverlay.overlayArtifact.overlay
  });
  const ambiguousFamilyRecord = {
    ...localInput.localRecords[0],
    documentIdentity: `${localInput.localRecords[0].documentIdentity}|second-paper`,
    sourceDocumentId: 'local-fixture-second-paper',
    sourceQuestionId: 'local-fixture-second-paper#1'
  };
  const checks = {
    topologyAndOverlayProduceCompleteCorpus: local.completeStructuredCorpusRebuilt === true
      && local.unresolvedConflictCount === 0 && local.revisionCount === 1
      && local.structuredRevisionCount === 2,
    formalStructuredRevisionsAreSchemaValidAndLineageMerged:
      local.structuredRevisions.every(subjectPracticeStructuredSourceQuestionRevisionValid)
      && local.structuredRevisions[0].lineageHash === local.structuredRevisions[1].lineageHash,
    rebuiltCorpusFeedsCommonFragmentQualification: downstreamCorpusQualification !== null
      && downstreamCorpusQualification.revisionCount === 2
      && downstreamCorpusQualification.independentLineageCount === 1,
    selectedLocalRevisionApplied: local.revisions[0].fields.answer === 'A',
    selectedDatabaseRevisionApplied: database.revisions[0].fields.answer === 'B',
    explicitExclusionRemovesConflict: excluded.revisionCount === 0
      && excluded.excludedConflictCount === 1
      && excluded.completeStructuredCorpusRebuilt === false
      && excluded.requiresInventoryReissue === true,
    rebuiltCorpusRemainsNonqualifying: local.formalReleaseEligible === false
      && local.requiresThresholdCalibration === true && local.requiresScannerAttestation === true,
    tamperedOverlayRejected: throws(() => rebuildStructuredCorpus(tamperedOverlay)),
    staleTopologyInventoryRejected: throws(() => rebuildStructuredCorpus(staleInventory)),
    incompleteConflictSetRejected: throws(() => rebuildStructuredCorpus(incompleteOverlay)),
    countDriftRejected: throws(() => rebuildStructuredCorpus({
      ...testInput('use_local'), databaseRecords: []
    })),
    ambiguousLegacyFamilyRejectedBeforeRebuild: throws(() => validateRecordSet([
      localInput.localRecords[0], ambiguousFamilyRecord
    ], 'local_file')),
    preflightHasNoSideEffects: preflight({}).status === 'preflight_only_no_files_read_or_written',
    pathEscapeRejected: throws(() => workspaceJsonPath(process.cwd(), '../outside.json', { mustBeNew: true }))
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: `${SCHEMA_VERSION}-self-test-v1`,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

if (require.main === module) {
  try {
    const args = argsFrom(process.argv.slice(2));
    let report;
    if (args['self-test']) report = runSelfTest();
    else if (!args.execute) report = preflight();
    else {
      const required = ['evidence', 'issue', 'reconciliation', 'db-inventory', 'overlay', 'out'];
      if (required.some((key) => !text(args[key]))) {
        throw new Error('source_corpus_structured_rebuild_execute_inputs_missing');
      }
      const now = text(args.now) || new Date().toISOString();
      if (!Number.isFinite(Date.parse(now)) || new Date(now).toISOString() !== now) {
        throw new Error('source_corpus_structured_rebuild_now_invalid');
      }
      report = execute({
        evidence: args.evidence, issue: args.issue, reconciliation: args.reconciliation,
        dbInventory: args['db-inventory'], overlay: args.overlay, out: args.out, now
      });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MODE,
  argsFrom,
  workspaceJsonPath,
  localRecordsFromWorkspace,
  databaseRecordsFromInventory,
  sourceDocumentFamilyIdentity,
  sourceDocumentFamilyIdentityBasis,
  rebuildStructuredCorpus,
  preflight,
  execute,
  runSelfTest
};
