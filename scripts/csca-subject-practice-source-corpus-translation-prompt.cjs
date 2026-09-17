#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const fs = require('node:fs');
const path = require('node:path');
const { buildLocalCorpus } = require('./csca-subject-practice-source-corpus-scan.cjs');
const { verifyDbArtifact } = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');
const { localRecordsFromWorkspace, databaseRecordsFromInventory } = require(
  './csca-subject-practice-source-corpus-structured-rebuild.cjs'
);
const {
  sha256, payloadValid, lineageKey, sourceFields
} = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');

const MODE = 'subject_practice_source_corpus_translation_prompt_v1';
const SCHEMA_VERSION = 'subject-practice-source-corpus-translation-prompt-v1';
const SYSTEM_PROMPT = [
  'You translate authorized CSCA source questions for internal bilingual corpus preparation.',
  'Return one JSON object only; do not use markdown.',
  'Do not solve, simplify, rewrite, improve, or change the question.',
  'Preserve itemId, option labels and order, correctAnswer, equations, symbols, units, subscripts, superscripts, and scientific notation exactly.',
  'Translate prompt, option text, and explanation into targetLanguage. Preserve proper nouns when translation would change identity.',
  'Do not add facts, hints, commentary, or new localizations.',
  'The output schema is {"items":[{"itemId":string,"targetLanguage":"en"|"zh","prompt":string,"options":array,"correctAnswer":string,"explanation":string}]}.'
].join('\n');

function text(value) { return String(value ?? '').trim(); }
function positiveInteger(value, name, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) throw new Error(`${name}_invalid`);
  return parsed;
}

function recordForJob(job, records) {
  const record = records.find((candidate) => lineageKey(candidate) === job.sourceLineageKey
    && candidate.sourceSystem === job.sourceSystem
    && text(candidate.sourceDocumentId) === job.sourceDocumentId
    && text(candidate.sourceQuestionId) === job.sourceQuestionId
    && text(candidate.language).toLowerCase() === job.sourceLanguage);
  if (!record || sha256(sourceFields(record)) !== job.sourceContentSha256) {
    throw new Error('source_corpus_translation_prompt_source_binding_invalid_or_stale');
  }
  return record;
}

function buildPromptArtifact(input) {
  const workPack = input.workPack;
  if (workPack?.schemaVersion !== 'subject-practice-source-corpus-translation-work-pack-v1'
    || workPack.status !== 'planned_unexecuted_ready_for_explicit_provider_authorization'
    || workPack.executionAuthorized !== false || workPack.formalReleaseEligible !== false
    || !Array.isArray(workPack.translationBatches)) {
    throw new Error('source_corpus_translation_prompt_work_pack_invalid');
  }
  const batch = workPack.translationBatches.find((candidate) => candidate.batchId === text(input.batchId));
  if (!batch || batch.status !== 'planned_unexecuted_requires_explicit_provider_authorization'
    || batch.itemCount !== batch.jobs?.length || batch.itemCount <= 0
    || batch.itemCount > workPack.settings.maxTranslationItemsPerCall) {
    throw new Error('source_corpus_translation_prompt_batch_invalid');
  }
  const model = text(input.model);
  if (!model || model.length > 100) throw new Error('source_corpus_translation_prompt_model_invalid');
  const maxOutputTokens = positiveInteger(input.maxOutputTokens,
    'source_corpus_translation_prompt_max_output_tokens', 16_000);
  const allRecords = [...input.localRecords, ...input.databaseRecords];
  const items = batch.jobs.map((job, index) => {
    const record = recordForJob(job, allRecords);
    const fields = sourceFields(record);
    return {
      itemId: `${batch.batchId}-item-${String(index + 1).padStart(2, '0')}`,
      sourceLineageKey: job.sourceLineageKey,
      sourceContentSha256: job.sourceContentSha256,
      sourceLanguage: job.sourceLanguage,
      targetLanguage: job.targetLanguage,
      prompt: fields.prompt,
      options: fields.options,
      correctAnswer: fields.answer,
      explanation: fields.explanation
    };
  });
  const userPayload = JSON.stringify({
    task: 'translate_source_questions_without_changing_semantics',
    subject: batch.subject,
    targetLanguage: batch.targetLanguage,
    requiredItemCount: batch.itemCount,
    items
  });
  const exactPromptCharacterCount = SYSTEM_PROMPT.length + userPayload.length;
  if (exactPromptCharacterCount > workPack.settings.maxPromptCharactersPerCall) {
    throw new Error('source_corpus_translation_prompt_exact_prompt_budget_exceeded');
  }
  const providerRequest = {
    provider: 'deepseek', model, temperature: 0, maxTokens: maxOutputTokens,
    responseFormat: 'json',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPayload }]
  };
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: 'prompt_materialized_unexecuted_requires_explicit_provider_authorization',
    workPackPayloadSha256: workPack.payloadSha256,
    batchId: batch.batchId,
    subject: batch.subject,
    targetLanguage: batch.targetLanguage,
    itemCount: items.length,
    exactPromptCharacterCount,
    maxPromptCharactersPerCall: workPack.settings.maxPromptCharactersPerCall,
    maxEstimatedCostUsd: batch.maxEstimatedCostUsd,
    sourceBindings: items.map((item) => ({ itemId: item.itemId,
      sourceLineageKey: item.sourceLineageKey, sourceContentSha256: item.sourceContentSha256 })),
    providerRequest,
    providerRequestSha256: sha256(providerRequest),
    expectedResponseSchema: {
      type: 'object', required: ['items'], additionalProperties: false,
      itemsMustExactlyMatchRequestedItemIds: true,
      correctAnswerMustRemainInvariant: true,
      optionLabelsAndOrderMustRemainInvariant: true
    },
    executionAuthorized: false,
    providerImpact: 'none_prompt_materialization_only',
    databaseImpact: 'none_reads_current_sources_only',
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
    throw new Error('source_corpus_translation_prompt_workspace_json_path_invalid');
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
  return { mode: MODE, status: 'preflight_only_no_files_read_or_written', executeRequired: true,
    requiredInputs: ['current_work_pack', 'batch_id', 'bound_db_inventory', 'bound_reconciliation',
      'configured_model', 'max_output_tokens', 'new_output_json'],
    executionAuthorized: false, providerImpact: 'none_no_provider_call', databaseImpact: 'none',
    publicationImpact: 'none' };
}

function execute(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const read = (value) => JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, value,
    { mustExist: true }), 'utf8'));
  const workPack = read(input.workPack);
  const databaseInventory = read(input.dbInventory);
  const reconciliation = read(input.reconciliation);
  const currentLocalSnapshot = buildLocalCorpus(workspaceRoot).snapshotSha256;
  const bindings = workPack.sourceEvidenceBindings ?? {};
  if (!payloadValid(workPack) || !verifyDbArtifact(databaseInventory) || !payloadValid(reconciliation)
    || bindings.databaseInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || bindings.reconciliationPayloadSha256 !== reconciliation.payloadSha256
    || bindings.localCorpusSnapshotSha256 !== currentLocalSnapshot
    || reconciliation.dbInventoryPayloadSha256 !== databaseInventory.payloadSha256
    || reconciliation.localCorpusSnapshotSha256 !== currentLocalSnapshot) {
    throw new Error('source_corpus_translation_prompt_input_invalid_or_stale');
  }
  const local = localRecordsFromWorkspace(workspaceRoot);
  const artifact = buildPromptArtifact({ ...input, workPack, localRecords: local.records,
    databaseRecords: databaseRecordsFromInventory(databaseInventory) });
  const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...artifact, outputPath };
}

function fixture() {
  const record = { documentFamilyIdentity: 'chemistry|past_paper|2026|fixture', questionNumber: '1',
    subject: 'chemistry', language: 'zh', sourceSystem: 'local_file', sourceDocumentId: 'doc-1',
    sourceQuestionId: 'q-1', fields: { prompt: '25 °C 时，下列关于 H2O 的说法正确的是？',
      options: [{ id: 'A', text: '甲' }, { id: 'B', text: '乙' }], answer: 'A',
      explanation: '25 °C 时，甲符合 H2O 的定义。', localizations: {} } };
  const fields = sourceFields(record);
  const job = { subject: 'chemistry', sourceLineageKey: lineageKey(record), sourceContentSha256: sha256(fields),
    sourceLanguage: 'zh', targetLanguage: 'en', sourceSystem: 'local_file',
    sourceDocumentId: 'doc-1', sourceQuestionId: 'q-1' };
  const workPackPayload = { schemaVersion: 'subject-practice-source-corpus-translation-work-pack-v1',
    status: 'planned_unexecuted_ready_for_explicit_provider_authorization', executionAuthorized: false,
    formalReleaseEligible: false, settings: { maxTranslationItemsPerCall: 6,
      maxPromptCharactersPerCall: 15_000, maxEstimatedTotalCostUsd: 0.006 },
    translationTaskCount: 1, translationBatchCount: 1,
    translationBatches: [{ batchId: 'translation-batch-0001',
      status: 'planned_unexecuted_requires_explicit_provider_authorization', subject: 'chemistry',
      targetLanguage: 'en', itemCount: 1, maxEstimatedCostUsd: 0.006, jobs: [job] }] };
  const workPack = { ...workPackPayload, payloadSha256: sha256(workPackPayload) };
  return { record, workPack };
}

function throws(fn) { try { fn(); return false; } catch { return true; } }

function runSelfTest() {
  const { record, workPack } = fixture();
  const artifact = buildPromptArtifact({ workPack, batchId: 'translation-batch-0001',
    localRecords: [record], databaseRecords: [], model: 'fixture-model', maxOutputTokens: 3000 });
  const tampered = { ...record, fields: { ...record.fields, answer: 'B' } };
  const checks = {
    exactBatchMaterialized: artifact.itemCount === 1
      && artifact.providerRequest.messages.length === 2,
    jsonOnlyDeterministicRequest: artifact.providerRequest.temperature === 0
      && artifact.providerRequest.responseFormat === 'json',
    requestBoundToWorkPackAndSource: artifact.workPackPayloadSha256 === workPack.payloadSha256
      && artifact.sourceBindings[0].sourceContentSha256 === workPack.translationBatches[0].jobs[0].sourceContentSha256,
    remainsUnexecuted: artifact.executionAuthorized === false
      && artifact.status.includes('unexecuted'),
    tamperedSourceRejected: throws(() => buildPromptArtifact({ workPack,
      batchId: 'translation-batch-0001', localRecords: [tampered], databaseRecords: [],
      model: 'fixture-model', maxOutputTokens: 3000 })),
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
      const required = ['work-pack', 'batch-id', 'db-inventory', 'reconciliation', 'model',
        'max-output-tokens', 'out'];
      if (required.some((key) => !text(args[key]))) throw new Error('source_corpus_translation_prompt_execute_inputs_missing');
      report = execute({ workPack: args['work-pack'], batchId: args['batch-id'],
        dbInventory: args['db-inventory'], reconciliation: args.reconciliation, model: args.model,
        maxOutputTokens: args['max-output-tokens'], out: args.out });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, SCHEMA_VERSION, SYSTEM_PROMPT, buildPromptArtifact, workspaceJsonPath,
  preflight, execute, fixture, runSelfTest };
