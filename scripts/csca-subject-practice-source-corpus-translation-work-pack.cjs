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
const { buildLocalCorpus } = require('./csca-subject-practice-source-corpus-scan.cjs');
const { verifyDbArtifact } = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');
const {
  localRecordsFromWorkspace,
  databaseRecordsFromInventory
} = require('./csca-subject-practice-source-corpus-structured-rebuild.cjs');
const { payloadValid } = require('./csca-subject-practice-source-corpus-length-axis-capacity.cjs');

const MODE = 'subject_practice_source_corpus_translation_work_pack_v1';
const SCHEMA_VERSION = 'subject-practice-source-corpus-translation-work-pack-v1';
const TRANSLATION_TASK = 'verified_translation_of_existing_source_lineage';
const ACQUISITION_TASK = 'new_independent_bilingual_source_lineage';

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(
    typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value))
  ).digest('hex');
}

function text(value) { return String(value ?? '').trim(); }
function money(value) { return Math.round(Number(value) * 1_000_000) / 1_000_000; }
function lineageKey(record) {
  return `${text(record.documentFamilyIdentity).toLowerCase()}|${text(record.questionNumber)}`;
}

function positiveInteger(value, name, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) throw new Error(`${name}_invalid`);
  return parsed;
}

function positiveMoney(value, name, maximum = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) throw new Error(`${name}_invalid`);
  return money(parsed);
}

function sourceFields(record) {
  const fields = record.fields ?? {};
  return canonicalJsonValue({
    prompt: fields.prompt ?? '', options: fields.options ?? [], answer: fields.answer ?? '',
    explanation: fields.explanation ?? '', localizations: fields.localizations ?? {}
  });
}

function sourceIndex(records) {
  const index = new Map();
  for (const record of records) {
    const key = lineageKey(record);
    const list = index.get(key) ?? [];
    list.push(record);
    index.set(key, list);
  }
  for (const list of index.values()) list.sort((left, right) => {
    const sourceOrder = { local_file: 0, database_query: 1 };
    return (sourceOrder[left.sourceSystem] ?? 9) - (sourceOrder[right.sourceSystem] ?? 9)
      || text(left.language).localeCompare(text(right.language));
  });
  return index;
}

function translationJob(task, recordsByLineage) {
  const candidates = recordsByLineage.get(text(task.sourceLineageKey).toLowerCase()) ?? [];
  const allowedLanguages = new Set((task.sourceLanguages ?? []).map((value) => text(value).toLowerCase()));
  const source = candidates.find((record) => allowedLanguages.has(text(record.language).toLowerCase()));
  if (!source) throw new Error('source_corpus_translation_work_pack_bound_source_missing');
  const subject = text(task.subject).toLowerCase();
  const targetLanguage = text(task.targetLanguage).toLowerCase();
  if (!['math', 'physics', 'chemistry'].includes(subject) || !['en', 'zh'].includes(targetLanguage)
    || text(source.subject).toLowerCase() !== subject
    || text(source.language).toLowerCase() === targetLanguage) {
    throw new Error('source_corpus_translation_work_pack_language_or_subject_binding_invalid');
  }
  const fields = sourceFields(source);
  const sourceCharacterCount = JSON.stringify(fields).length;
  return {
    taskType: TRANSLATION_TASK,
    subject,
    targetLanguage,
    sourceLineageKey: text(task.sourceLineageKey).toLowerCase(),
    sourceLanguage: text(source.language).toLowerCase(),
    sourceSystem: text(source.sourceSystem),
    sourceDocumentId: text(source.sourceDocumentId),
    sourceQuestionId: text(source.sourceQuestionId),
    sourceContentSha256: sha256(fields),
    sourceCharacterCount,
    estimatedPromptCharacters: sourceCharacterCount + 800,
    status: 'planned_unexecuted',
    studentPublicationAllowed: false
  };
}

function batchTranslationJobs(jobs, settings) {
  const groups = new Map();
  for (const job of jobs) {
    if (job.estimatedPromptCharacters > settings.maxPromptCharactersPerCall) {
      throw new Error('source_corpus_translation_work_pack_single_task_prompt_budget_exceeded');
    }
    const key = `${job.subject}|${job.targetLanguage}`;
    const list = groups.get(key) ?? [];
    list.push(job);
    groups.set(key, list);
  }
  const batches = [];
  for (const [groupKey, unsorted] of Array.from(groups.entries()).sort()) {
    const [subject, targetLanguage] = groupKey.split('|');
    const sorted = unsorted.sort((left, right) => left.sourceLineageKey.localeCompare(right.sourceLineageKey));
    let current = [];
    let currentCharacters = 0;
    const flush = () => {
      if (!current.length) return;
      batches.push({ subject, targetLanguage, jobs: current, estimatedPromptCharacters: currentCharacters });
      current = []; currentCharacters = 0;
    };
    for (const job of sorted) {
      if (current.length && (current.length >= settings.maxTranslationItemsPerCall
        || currentCharacters + job.estimatedPromptCharacters > settings.maxPromptCharactersPerCall)) flush();
      current.push(job); currentCharacters += job.estimatedPromptCharacters;
    }
    flush();
  }
  return batches.map((batch, index) => ({
    batchId: `translation-batch-${String(index + 1).padStart(4, '0')}`,
    subject: batch.subject,
    targetLanguage: batch.targetLanguage,
    itemCount: batch.jobs.length,
    estimatedPromptCharacters: batch.estimatedPromptCharacters,
    maxEstimatedCostUsd: settings.maxEstimatedCostUsdPerCall,
    status: 'planned_unexecuted_requires_explicit_provider_authorization',
    jobs: batch.jobs
  }));
}

function buildWorkPack(input) {
  const capacity = input.capacity;
  if (capacity?.schemaVersion !== 'subject-practice-source-corpus-length-axis-capacity-v3'
    || capacity.generatedCandidatesMayFillSourceCapacity !== false
    || !Array.isArray(capacity.acquisitionQueue)
    || ![capacity.payloadSha256, capacity.databaseInventoryPayloadSha256,
      capacity.reconciliationPayloadSha256, capacity.localCorpusSnapshotSha256]
      .every((value) => /^[a-f0-9]{64}$/.test(text(value)))) {
    throw new Error('source_corpus_translation_work_pack_capacity_invalid');
  }
  const allowedTaskTypes = new Set([TRANSLATION_TASK, ACQUISITION_TASK]);
  const taskKeys = capacity.acquisitionQueue.map((task) => task.taskType === TRANSLATION_TASK
    ? `${task.taskType}|${text(task.subject)}|${text(task.targetLanguage)}|${text(task.sourceLineageKey)}`
    : `${task.taskType}|${text(task.subject)}|${text(task.acquisitionSlot)}`);
  if (capacity.acquisitionQueue.some((task) => !allowedTaskTypes.has(task.taskType)
      || task.generatedCandidateMaySubstitute !== false)
    || new Set(taskKeys).size !== taskKeys.length) {
    throw new Error('source_corpus_translation_work_pack_queue_invalid_or_duplicate');
  }
  const settings = {
    maxTranslationItemsPerCall: positiveInteger(input.maxTranslationItemsPerCall,
      'source_corpus_translation_work_pack_max_items', 20),
    maxPromptCharactersPerCall: positiveInteger(input.maxPromptCharactersPerCall,
      'source_corpus_translation_work_pack_prompt_characters', 50_000),
    maxEstimatedCostUsdPerCall: positiveMoney(input.maxEstimatedCostUsdPerCall,
      'source_corpus_translation_work_pack_per_call_cost'),
    maxEstimatedTotalCostUsd: positiveMoney(input.maxEstimatedTotalCostUsd,
      'source_corpus_translation_work_pack_total_cost')
  };
  const recordsByLineage = sourceIndex([...input.localRecords, ...input.databaseRecords]);
  const translationJobs = capacity.acquisitionQueue.filter((task) => task.taskType === TRANSLATION_TASK)
    .map((task) => translationJob(task, recordsByLineage));
  const manualAcquisitionQueue = capacity.acquisitionQueue.filter((task) => task.taskType === ACQUISITION_TASK)
    .map((task) => ({
      ...task, status: 'planned_unexecuted_requires_authorized_source_acquisition',
      providerGenerationAllowed: false, studentPublicationAllowed: false
    }));
  if (translationJobs.length !== capacity.minimumVerifiedTranslationVariantsRequired
    || manualAcquisitionQueue.length !== capacity.minimumNewIndependentQuestionLineagesRequired
    || translationJobs.length + manualAcquisitionQueue.length !== capacity.acquisitionQueue.length) {
    throw new Error('source_corpus_translation_work_pack_queue_count_mismatch');
  }
  const translationBatches = batchTranslationJobs(translationJobs, settings);
  const maximumEstimatedProviderCostUsd = money(
    translationBatches.length * settings.maxEstimatedCostUsdPerCall
  );
  const withinDeclaredTotalCostCap = maximumEstimatedProviderCostUsd <= settings.maxEstimatedTotalCostUsd;
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: withinDeclaredTotalCostCap
      ? 'planned_unexecuted_ready_for_explicit_provider_authorization'
      : 'blocked_projected_cost_exceeds_declared_total_cap',
    sourceCapacityPayloadSha256: capacity.payloadSha256,
    sourceEvidenceBindings: {
      databaseInventoryPayloadSha256: capacity.databaseInventoryPayloadSha256,
      reconciliationPayloadSha256: capacity.reconciliationPayloadSha256,
      localCorpusSnapshotSha256: capacity.localCorpusSnapshotSha256
    },
    settings,
    translationTaskCount: translationJobs.length,
    translationBatchCount: translationBatches.length,
    manualIndependentBilingualAcquisitionTaskCount: manualAcquisitionQueue.length,
    maximumEstimatedProviderCostUsd,
    withinDeclaredTotalCostCap,
    translationBatches,
    manualAcquisitionQueue,
    acceptanceGate: {
      sourceHashMustMatch: true,
      questionAndOptionMeaningMustBePreserved: true,
      optionLabelsAndOrderMustBePreserved: true,
      correctAnswerMustRemainInvariant: true,
      mathematicalAndScientificNotationMustBePreserved: true,
      explanationMustRemainSemanticallyEquivalent: true,
      unsupportedFactsForbidden: true,
      independentHumanBilingualReviewRequired: true,
      failedItemsMayNotEnterSourceCorpus: true
    },
    executionAuthorized: false,
    formalReleaseEligible: false,
    providerImpact: 'none_plan_only_no_provider_call',
    databaseImpact: 'none_reads_existing_artifacts_only',
    publicationImpact: 'none_student_publication_forbidden'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot); const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target)) || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_translation_work_pack_workspace_json_path_invalid');
  }
  return target;
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) if (token.startsWith('--')) {
    const [key, ...rest] = token.slice(2).split('='); result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function preflight() {
  return {
    mode: MODE, status: 'preflight_only_no_files_read_or_written', executeRequired: true,
    requiredInputs: ['current_capacity_v3', 'bound_db_inventory_v2', 'bound_reconciliation_v3',
      'max_translation_items_per_call', 'max_prompt_characters_per_call',
      'max_estimated_cost_usd_per_call', 'max_estimated_total_cost_usd'],
    executionAuthorized: false, providerImpact: 'none_no_provider_call', databaseImpact: 'none',
    publicationImpact: 'none'
  };
}

function execute(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const capacity = JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, input.capacity,
    { mustExist: true }), 'utf8'));
  const databaseInventory = JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, input.dbInventory,
    { mustExist: true }), 'utf8'));
  const reconciliation = JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, input.reconciliation,
    { mustExist: true }), 'utf8'));
  const currentLocalSnapshot = buildLocalCorpus(workspaceRoot).snapshotSha256;
  if (!payloadValid(capacity) || !verifyDbArtifact(databaseInventory) || !payloadValid(reconciliation)
    || capacity.databaseInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || capacity.reconciliationPayloadSha256 !== reconciliation.payloadSha256
    || capacity.localCorpusSnapshotSha256 !== currentLocalSnapshot
    || reconciliation.dbInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || reconciliation.localCorpusSnapshotSha256 !== currentLocalSnapshot) {
    throw new Error('source_corpus_translation_work_pack_input_invalid_or_stale');
  }
  const local = localRecordsFromWorkspace(workspaceRoot);
  const report = buildWorkPack({ ...input, capacity, localRecords: local.records,
    databaseRecords: databaseRecordsFromInventory(databaseInventory) });
  const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...report, outputPath };
}

function fixtureRecord(id) {
  return { documentFamilyIdentity: `math|past_paper|2026|fixture-${id}`, questionNumber: '1',
    subject: 'math', language: 'en', sourceSystem: 'local_file', sourceDocumentId: `doc-${id}`,
    sourceQuestionId: `q-${id}`, fields: { prompt: `Question ${id}`, options: ['A', 'B'],
      answer: 'A', explanation: 'Because A.', localizations: {} } };
}

function throws(fn) { try { fn(); return false; } catch { return true; } }

function runSelfTest() {
  const records = Array.from({ length: 5 }, (_, index) => fixtureRecord(index + 1));
  const tasks = records.map((record) => ({ taskType: TRANSLATION_TASK, subject: 'math',
    targetLanguage: 'zh', sourceLineageKey: lineageKey(record), sourceLanguages: ['en'],
    generatedCandidateMaySubstitute: false }));
  const capacity = { schemaVersion: 'subject-practice-source-corpus-length-axis-capacity-v3',
    payloadSha256: sha256('fixture-capacity'), databaseInventoryPayloadSha256: sha256('fixture-db'),
    reconciliationPayloadSha256: sha256('fixture-reconcile'),
    localCorpusSnapshotSha256: sha256('fixture-local'), generatedCandidatesMayFillSourceCapacity: false,
    acquisitionQueue: tasks, minimumVerifiedTranslationVariantsRequired: 5,
    minimumNewIndependentQuestionLineagesRequired: 0 };
  const accepted = buildWorkPack({ capacity, localRecords: records, databaseRecords: [],
    maxTranslationItemsPerCall: 2, maxPromptCharactersPerCall: 5000,
    maxEstimatedCostUsdPerCall: 0.006, maxEstimatedTotalCostUsd: 0.018 });
  const blocked = buildWorkPack({ capacity, localRecords: records, databaseRecords: [],
    maxTranslationItemsPerCall: 2, maxPromptCharactersPerCall: 5000,
    maxEstimatedCostUsdPerCall: 0.006, maxEstimatedTotalCostUsd: 0.012 });
  const checks = {
    boundedBatchingProducesThreeCalls: accepted.translationBatchCount === 3
      && accepted.translationBatches.every((batch) => batch.itemCount <= 2),
    exactCostCeilingAccepted: accepted.maximumEstimatedProviderCostUsd === 0.018
      && accepted.withinDeclaredTotalCostCap === true,
    totalCostCapFailsClosed: blocked.status === 'blocked_projected_cost_exceeds_declared_total_cap'
      && blocked.executionAuthorized === false,
    everyJobBoundToSourceHash: accepted.translationBatches.flatMap((batch) => batch.jobs)
      .every((job) => /^[a-f0-9]{64}$/.test(job.sourceContentSha256)),
    missingSourceRejected: throws(() => buildWorkPack({ capacity,
      localRecords: records.slice(1), databaseRecords: [], maxTranslationItemsPerCall: 2,
      maxPromptCharactersPerCall: 5000, maxEstimatedCostUsdPerCall: 0.006,
      maxEstimatedTotalCostUsd: 0.018 })),
    generatedCandidateSubstitutionRejected: throws(() => buildWorkPack({
      capacity: { ...capacity, acquisitionQueue: capacity.acquisitionQueue.map((task, index) =>
        index === 0 ? { ...task, generatedCandidateMaySubstitute: true } : task) },
      localRecords: records, databaseRecords: [], maxTranslationItemsPerCall: 2,
      maxPromptCharactersPerCall: 5000, maxEstimatedCostUsdPerCall: 0.006,
      maxEstimatedTotalCostUsd: 0.018 })),
    preflightHasNoSideEffects: preflight().status === 'preflight_only_no_files_read_or_written',
    pathEscapeRejected: throws(() => workspaceJsonPath(process.cwd(), '../outside.json', { mustBeNew: true }))
  };
  return { mode: `${MODE}_self_test`, reportVersion: `${SCHEMA_VERSION}-self-test-v1`,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_fixture_only', publicationImpact: 'none' };
}

if (require.main === module) {
  try {
    const args = argsFrom(process.argv.slice(2));
    let report;
    if (args['self-test']) report = runSelfTest();
    else if (!args.execute) report = preflight();
    else {
      const required = ['capacity', 'db-inventory', 'reconciliation', 'out', 'max-translation-items-per-call',
        'max-prompt-characters-per-call', 'max-estimated-cost-usd-per-call', 'max-estimated-total-cost-usd'];
      if (required.some((key) => !text(args[key]))) throw new Error('source_corpus_translation_work_pack_execute_inputs_missing');
      report = execute({ capacity: args.capacity, dbInventory: args['db-inventory'],
        reconciliation: args.reconciliation, out: args.out,
        maxTranslationItemsPerCall: args['max-translation-items-per-call'],
        maxPromptCharactersPerCall: args['max-prompt-characters-per-call'],
        maxEstimatedCostUsdPerCall: args['max-estimated-cost-usd-per-call'],
        maxEstimatedTotalCostUsd: args['max-estimated-total-cost-usd'] });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, SCHEMA_VERSION, sha256, payloadValid, lineageKey, sourceFields,
  buildWorkPack, workspaceJsonPath, preflight, execute, runSelfTest };
