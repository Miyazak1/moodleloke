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
  SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-length-policy');
const {
  buildLocalCorpus
} = require('./csca-subject-practice-source-corpus-scan.cjs');
const {
  verifyDbArtifact
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');
const {
  localRecordsFromWorkspace,
  databaseRecordsFromInventory
} = require('./csca-subject-practice-source-corpus-structured-rebuild.cjs');

const MODE = 'subject_practice_source_corpus_length_axis_capacity_v3';
const SCHEMA_VERSION = 'subject-practice-source-corpus-length-axis-capacity-v3';
const SUBJECTS = Object.freeze(['math', 'physics', 'chemistry']);
const LANGUAGES = Object.freeze(['en', 'zh']);
const FIELDS = Object.freeze(['prompt', 'options', 'answer', 'explanation', 'localizations']);

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
  return crypto.createHash('sha256').update(
    typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value))
  ).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function payloadValid(artifact) {
  if (!artifact || !/^[a-f0-9]{64}$/.test(text(artifact.payloadSha256))) return false;
  const { payloadSha256, ...payload } = artifact;
  return sha256(payload) === payloadSha256;
}

function recordKey(record) {
  return `${text(record.documentFamilyIdentity).toLowerCase()}|${text(record.questionNumber)}`;
}

function validateFamilyIdentityUnambiguity(records) {
  const identitiesByScopedFamily = new Map();
  for (const record of records) {
    const scopedFamily = [record.sourceSystem, record.subject, record.language, record.documentFamilyIdentity]
      .map((value) => text(value).toLowerCase()).join('|');
    const identities = identitiesByScopedFamily.get(scopedFamily) ?? new Set();
    identities.add(text(record.documentIdentity).toLowerCase());
    identitiesByScopedFamily.set(scopedFamily, identities);
  }
  const ambiguous = Array.from(identitiesByScopedFamily.entries())
    .filter(([, identities]) => identities.size > 1).map(([scopedFamily]) => scopedFamily);
  if (ambiguous.length) throw new Error('source_corpus_length_axis_capacity_document_family_ambiguous');
  return {
    scopedDocumentFamilyCount: identitiesByScopedFamily.size,
    explicitSourceDocumentCount: new Set(records
      .filter((record) => record.documentFamilyIdentityBasis === 'explicit_source_family_id')
      .map((record) => `${record.sourceSystem}|${record.documentIdentity}`)).size,
    legacyFallbackSourceDocumentCount: new Set(records
      .filter((record) => record.documentFamilyIdentityBasis !== 'explicit_source_family_id')
      .map((record) => `${record.sourceSystem}|${record.documentIdentity}`)).size,
    ambiguousScopedFamilyCount: 0
  };
}

function documentFamilyIdentityBackfillFor(records) {
  const entries = new Map();
  for (const record of records) {
    if (record.documentFamilyIdentityBasis === 'explicit_source_family_id') continue;
    const key = `${text(record.sourceSystem)}|${text(record.documentIdentity).toLowerCase()}`;
    if (!entries.has(key)) entries.set(key, {
      sourceSystem: text(record.sourceSystem),
      sourceDocumentId: text(record.sourceDocumentId),
      documentIdentity: text(record.documentIdentity).toLowerCase(),
      proposedDocumentFamilyId: text(record.documentFamilyIdentity).toLowerCase(),
      status: 'planned_not_applied',
      requiresDatabaseWrite: record.sourceSystem === 'database_query'
    });
  }
  return Array.from(entries.values()).sort((left, right) =>
    `${left.sourceSystem}|${left.documentIdentity}`.localeCompare(`${right.sourceSystem}|${right.documentIdentity}`));
}

function assessAxisCapacity(input) {
  const records = [...input.localRecords, ...input.databaseRecords];
  const invalid = records.filter((record) => !SUBJECTS.includes(text(record.subject).toLowerCase())
    || !LANGUAGES.includes(text(record.language).toLowerCase())
    || !text(record.documentFamilyIdentity) || !recordKey(record));
  if (invalid.length) throw new Error('source_corpus_length_axis_capacity_record_invalid');
  const familyIdentityAssurance = validateFamilyIdentityUnambiguity(records);
  const documentFamilyIdentityBackfill = documentFamilyIdentityBackfillFor(records);
  const lineageByKey = new Map();
  for (const record of records) {
    const key = recordKey(record);
    const subject = text(record.subject).toLowerCase();
    const language = text(record.language).toLowerCase();
    const existing = lineageByKey.get(key);
    if (existing && existing.subject !== subject) {
      throw new Error('source_corpus_length_axis_capacity_identity_subject_language_conflict');
    }
    const languages = existing?.languages ?? new Set();
    languages.add(language);
    lineageByKey.set(key, { key, subject, languages });
  }
  const languageAxes = [];
  for (const subject of SUBJECTS) for (const language of LANGUAGES) {
    const lineageCount = Array.from(lineageByKey.values())
      .filter((lineage) => lineage.subject === subject && lineage.languages.has(language)).length;
    const additionalQuestionLineagesRequired = Math.max(
      0, SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS - lineageCount
    );
    languageAxes.push({
      subject,
      language,
      currentQuestionLineageCount: lineageCount,
      minimumQuestionLineagesRequired: SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS,
      additionalQuestionLineagesRequired,
      fieldAxisCount: FIELDS.length,
      currentObservationsPerFieldAxis: lineageCount,
      minimumObservationsPerFieldAxis: SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS,
      qualifiedCapacity: additionalQuestionLineagesRequired === 0
    });
  }
  const fieldAxes = languageAxes.flatMap((axis) => FIELDS.map((field) => ({
    subject: axis.subject,
    language: axis.language,
    field,
    currentObservationCount: axis.currentQuestionLineageCount,
    minimumObservationCount: axis.minimumQuestionLineagesRequired,
    observationDeficit: axis.additionalQuestionLineagesRequired,
    qualifiedCapacity: axis.qualifiedCapacity
  })));
  const additionalQuestionLineagesRequired = languageAxes
    .reduce((sum, axis) => sum + axis.additionalQuestionLineagesRequired, 0);
  const subjectAcquisitionBundles = SUBJECTS.map((subject) => {
    const subjectLineages = Array.from(lineageByKey.values())
      .filter((lineage) => lineage.subject === subject).sort((left, right) => left.key.localeCompare(right.key));
    const unionLineageCount = subjectLineages.length;
    const axes = languageAxes.filter((axis) => axis.subject === subject);
    const additionalLanguageVariantsRequired = axes
      .reduce((sum, axis) => sum + axis.additionalQuestionLineagesRequired, 0);
    const newIndependentLineagesRequired = Math.max(
      0, SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS - unionLineageCount
    );
    const newBilingualVariantsRequired = newIndependentLineagesRequired * LANGUAGES.length;
    const verifiedTranslationTasks = LANGUAGES.flatMap((targetLanguage) => {
      const axis = axes.find((candidate) => candidate.language === targetLanguage);
      const quota = Math.max(0, axis.additionalQuestionLineagesRequired - newIndependentLineagesRequired);
      return subjectLineages.filter((lineage) => !lineage.languages.has(targetLanguage)).slice(0, quota)
        .map((lineage) => ({
          taskType: 'verified_translation_of_existing_source_lineage',
          subject,
          targetLanguage,
          sourceLineageKey: lineage.key,
          sourceLanguages: Array.from(lineage.languages).sort(),
          generatedCandidateMaySubstitute: false
        }));
    });
    const newIndependentBilingualTasks = Array.from(
      { length: newIndependentLineagesRequired }, (_, index) => ({
        taskType: 'new_independent_bilingual_source_lineage',
        subject,
        acquisitionSlot: `${subject}-new-independent-bilingual-${String(index + 1).padStart(3, '0')}`,
        requiredLanguages: [...LANGUAGES],
        generatedCandidateMaySubstitute: false
      })
    );
    return {
      plan: {
        subject,
        currentCrossLanguageLineageUnionCount: unionLineageCount,
        newIndependentLineagesRequired,
        newBilingualVariantsRequired,
        verifiedTranslationVariantsRequired: Math.max(
          0, additionalLanguageVariantsRequired - newBilingualVariantsRequired
        ),
        additionalLanguageVariantsRequired
      },
      tasks: [...newIndependentBilingualTasks, ...verifiedTranslationTasks]
    };
  });
  const subjectAcquisitionPlan = subjectAcquisitionBundles.map((bundle) => bundle.plan);
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: additionalQuestionLineagesRequired === 0
      ? 'length_axis_capacity_sufficient_pending_quality_and_attestation'
      : 'length_axis_capacity_inadequate',
    minimumObservationsPerSubjectLanguageFieldAxis:
      SUBJECT_PRACTICE_SOURCE_CORPUS_LENGTH_MINIMUM_OBSERVATIONS_PER_AXIS,
    sourceRecordCounts: {
      local: input.localRecords.length,
      database: input.databaseRecords.length,
      logicalUnion: lineageByKey.size
    },
    languageAxes,
    fieldAxes,
    qualifiedLanguageAxisCount: languageAxes.filter((axis) => axis.qualifiedCapacity).length,
    totalLanguageAxisCount: languageAxes.length,
    qualifiedFieldAxisCount: fieldAxes.filter((axis) => axis.qualifiedCapacity).length,
    totalFieldAxisCount: fieldAxes.length,
    additionalQuestionLineagesRequired,
    totalFieldObservationDeficit: fieldAxes.reduce((sum, axis) => sum + axis.observationDeficit, 0),
    subjectAcquisitionPlan,
    acquisitionQueue: subjectAcquisitionBundles.flatMap((bundle) => bundle.tasks),
    minimumNewIndependentQuestionLineagesRequired: subjectAcquisitionPlan
      .reduce((sum, subject) => sum + subject.newIndependentLineagesRequired, 0),
    minimumNewBilingualVariantsRequired: subjectAcquisitionPlan
      .reduce((sum, subject) => sum + subject.newBilingualVariantsRequired, 0),
    minimumVerifiedTranslationVariantsRequired: subjectAcquisitionPlan
      .reduce((sum, subject) => sum + subject.verifiedTranslationVariantsRequired, 0),
    familyIdentityAssurance,
    documentFamilyIdentityBackfill,
    generatedCandidatesMayFillSourceCapacity: false,
    capacityIsOptimisticBeforeConflictExclusions: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_existing_inventory_artifact_only',
    publicationImpact: 'none_capacity_diagnostic_only'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target))
    || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_length_axis_capacity_workspace_json_path_invalid');
  }
  return target;
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

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    executeRequired: true,
    requiredInputs: ['current_db_inventory_v2', 'current_inventory_reconcile_v3'],
    outputOptional: true,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function execute(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const databaseInventory = JSON.parse(fs.readFileSync(
    workspaceJsonPath(workspaceRoot, input.dbInventory, { mustExist: true }), 'utf8'
  ));
  const reconciliation = JSON.parse(fs.readFileSync(
    workspaceJsonPath(workspaceRoot, input.reconciliation, { mustExist: true }), 'utf8'
  ));
  const localCorpus = buildLocalCorpus(workspaceRoot);
  if (!verifyDbArtifact(databaseInventory)
    || !payloadValid(reconciliation)
    || reconciliation.schemaVersion !== 'subject-practice-source-corpus-inventory-reconcile-v3'
    || reconciliation.mode !== 'subject_practice_source_corpus_inventory_reconcile_v3'
    || reconciliation.dbInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || reconciliation.localCorpusSnapshotSha256 !== localCorpus.snapshotSha256) {
    throw new Error('source_corpus_length_axis_capacity_input_invalid_or_stale');
  }
  const local = localRecordsFromWorkspace(workspaceRoot);
  const report = assessAxisCapacity({
    localRecords: local.records,
    databaseRecords: databaseRecordsFromInventory(databaseInventory)
  });
  const boundPayload = {
    ...report,
    databaseInventoryPayloadSha256: databaseInventory.payloadSha256,
    reconciliationPayloadSha256: reconciliation.payloadSha256,
    localCorpusSnapshotSha256: localCorpus.snapshotSha256
  };
  const artifact = {
    ...boundPayload,
    payloadSha256: sha256(Object.fromEntries(Object.entries(boundPayload)
      .filter(([key]) => key !== 'payloadSha256')))
  };
  if (input.out) {
    const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { ...artifact, outputWritten: true, outputPath };
  }
  return { ...artifact, outputWritten: false };
}

function fixtureRecord(subject, language, id, sourceSystem = 'local_file') {
  return {
    documentIdentity: `${subject}|fixture-${id}|${language}`,
    documentFamilyIdentity: `${subject}|past_paper|fixture-${id}`,
    documentFamilyIdentityBasis: 'explicit_source_family_id',
    questionNumber: '1', subject, language, sourceSystem
  };
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

function runSelfTest() {
  const localRecords = [];
  const databaseRecords = [];
  for (const subject of SUBJECTS) for (const language of LANGUAGES) {
    for (let index = 0; index < 200; index += 1) {
      localRecords.push(fixtureRecord(subject, language, index));
      if (index < 150) databaseRecords.push({
        ...fixtureRecord(subject, language, index, 'database_query')
      });
    }
  }
  const sufficient = assessAxisCapacity({ localRecords, databaseRecords });
  const inadequate = assessAxisCapacity({
    localRecords: localRecords.filter((record) => !(record.subject === 'physics'
      && record.language === 'zh' && Number(record.documentIdentity.split('-').at(-1).split('|')[0]) >= 125)),
    databaseRecords
  });
  const conflictRecords = [...localRecords];
  conflictRecords.push({ ...localRecords[0], subject: 'physics' });
  const ambiguousFamilyRecords = [
    fixtureRecord('math', 'en', 'ambiguous'),
    { ...fixtureRecord('math', 'en', 'ambiguous'), documentIdentity: 'math|second-paper|en' }
  ];
  const checks = {
    duplicateSourcesAndTranslationsCountOneLineage: sufficient.sourceRecordCounts.logicalUnion === 600
      && sufficient.sourceRecordCounts.local === 1200
      && sufficient.sourceRecordCounts.database === 900,
    allAxesSufficientAtTwoHundred: sufficient.status
      === 'length_axis_capacity_sufficient_pending_quality_and_attestation'
      && sufficient.qualifiedFieldAxisCount === 30,
    deficitCountsMissingQuestionLineagesNotFields: inadequate.additionalQuestionLineagesRequired === 50
      && inadequate.totalFieldObservationDeficit === 250,
    translationReuseAvoidsUnnecessaryNewQuestions:
      inadequate.minimumNewIndependentQuestionLineagesRequired === 0
      && inadequate.minimumVerifiedTranslationVariantsRequired === 50
      && inadequate.acquisitionQueue.length === 50
      && inadequate.acquisitionQueue.every((task) => task.taskType
        === 'verified_translation_of_existing_source_lineage'),
    ambiguousLegacyFamilyFailsClosed: throws(() => assessAxisCapacity({
      localRecords: ambiguousFamilyRecords, databaseRecords: []
    })),
    identitySubjectConflictRejected: throws(() => assessAxisCapacity({
      localRecords: conflictRecords, databaseRecords: []
    })),
    preflightHasNoSideEffects: preflight().status === 'preflight_only_no_files_read_or_written',
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
      if (!text(args['db-inventory']) || !text(args.reconciliation)) {
        throw new Error('source_corpus_length_axis_capacity_execute_inputs_missing');
      }
      report = execute({
        dbInventory: args['db-inventory'], reconciliation: args.reconciliation, out: args.out
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
  payloadValid,
  assessAxisCapacity,
  workspaceJsonPath,
  preflight,
  execute,
  runSelfTest
};
