#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');
const {
  buildSubjectPracticeSourceCorpusInventoryManifest,
  normalizeSubjectPracticeSourceCorpusText
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const { buildLocalCorpus } = require('./csca-subject-practice-source-corpus-scan.cjs');

const MODE = 'subject_practice_source_corpus_inventory_reconcile_v3';
const SCHEMA_VERSION = 'subject-practice-source-corpus-inventory-reconcile-v3';
const SOURCE_FIELDS = Object.freeze(['prompt', 'options', 'answer', 'explanation', 'localizations']);
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
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

function workspaceJsonPath(value, options = {}) {
  const root = resolve(options.workspaceRoot ?? process.cwd());
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('source_corpus_reconcile_path_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('source_corpus_reconcile_path_must_be_json');
  if (options.mustExist && !existsSync(target)) throw new Error('source_corpus_reconcile_input_missing');
  if (options.mustBeNew && existsSync(target)) throw new Error('source_corpus_reconcile_refuses_to_overwrite');
  return target;
}

function documentKey(document) {
  return [document.subject, document.examSession ?? '', document.language]
    .map((value) => text(value).toLowerCase()).join('|');
}

function sourceFieldRawValue(question, field) {
  if (field === 'prompt') return text(question.promptText ?? question.prompt);
  if (field === 'options') return JSON.stringify(canonicalJsonValue(question.options ?? []));
  if (field === 'answer') return text(question.correctAnswer ?? question.answer);
  if (field === 'explanation') return text(question.explanation);
  if (field === 'localizations') return JSON.stringify(canonicalJsonValue(question.localizations ?? {}));
  throw new Error('source_corpus_reconcile_unknown_field');
}

function sourceQuestionFieldHashes(question) {
  return Object.fromEntries(SOURCE_FIELDS.map((field) => {
    const rawValue = sourceFieldRawValue(question, field);
    return [field, {
      normalizedSha256: sha256(normalizeSubjectPracticeSourceCorpusText(rawValue)),
      rawSha256: sha256(rawValue)
    }];
  }));
}

function localDocuments(workspaceRoot = process.cwd()) {
  const docsDir = resolve(workspaceRoot, 'docs');
  return readdirSync(docsDir).filter((name) => /-source\.json$/i.test(name)
    && name !== 'csca-past-paper-source-json-template.json').sort().map((name) => {
      const parsed = JSON.parse(readFileSync(resolve(docsDir, name), 'utf8'));
      const document = parsed.document ?? {};
      return {
        key: documentKey(document),
        file: `docs/${name}`,
        document,
        questions: (parsed.questions ?? []).map((question, index) => ({
          questionNumber: text(question.questionNumber) || String(index + 1),
          promptSha256: sha256(normalizeSubjectPracticeSourceCorpusText(question.promptText ?? question.prompt)),
          rawPromptSha256: sha256(text(question.promptText ?? question.prompt)),
          fieldHashes: sourceQuestionFieldHashes(question)
        }))
      };
    });
}

function verifyDbArtifact(artifact) {
  const { payloadSha256, ...payload } = artifact;
  return /^[a-f0-9]{64}$/.test(text(payloadSha256))
    && sha256(JSON.stringify(canonicalJsonValue(payload))) === payloadSha256
    && artifact.mode === 'subject_practice_source_corpus_db_inventory_v2'
    && artifact.databaseImpact === 'read_only_repeatable_read_transaction';
}

function reconcile(input) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const dbPath = workspaceJsonPath(input.dbInventory, { workspaceRoot, mustExist: true });
  const db = JSON.parse(readFileSync(dbPath, 'utf8'));
  if (!verifyDbArtifact(db)) throw new Error('source_corpus_reconcile_db_artifact_invalid');
  const local = localDocuments(workspaceRoot);
  const dbDocuments = db.documents.map((document) => ({
    key: documentKey(document), document,
    questions: db.sourceQuestions.filter((question) => Number(question.documentId) === Number(document.id))
      .map((question) => ({
        questionNumber: text(question.questionNumber),
        promptSha256: sha256(normalizeSubjectPracticeSourceCorpusText(question.promptText)),
        rawPromptSha256: sha256(text(question.promptText)),
        fieldHashes: sourceQuestionFieldHashes(question)
      }))
  }));
  const localByKey = new Map(local.map((entry) => [entry.key, entry]));
  const dbByKey = new Map(dbDocuments.map((entry) => [entry.key, entry]));
  const allKeys = Array.from(new Set([...localByKey.keys(), ...dbByKey.keys()])).sort();
  const documents = [];
  let exactQuestionCount = 0;
  let normalizedEquivalentRawDifferenceCount = 0;
  let promptConflictCount = 0;
  let localOnlyQuestionCount = 0;
  let dbOnlyQuestionCount = 0;
  let exactRevisionCount = 0;
  let normalizedEquivalentRevisionCount = 0;
  let contentConflictCount = 0;
  const fieldConflictCounts = Object.fromEntries(SOURCE_FIELDS.map((field) => [field, 0]));
  for (const key of allKeys) {
    const localDocument = localByKey.get(key);
    const dbDocument = dbByKey.get(key);
    const localQuestions = new Map((localDocument?.questions ?? []).map((question) => [question.questionNumber, question]));
    const dbQuestions = new Map((dbDocument?.questions ?? []).map((question) => [question.questionNumber, question]));
    const questionNumbers = Array.from(new Set([...localQuestions.keys(), ...dbQuestions.keys()])).sort();
    const questionDifferences = [];
    for (const questionNumber of questionNumbers) {
      const localQuestion = localQuestions.get(questionNumber);
      const dbQuestion = dbQuestions.get(questionNumber);
      let status;
      let revisionStatus = null;
      let fieldDifferences = [];
      if (!localQuestion) { status = 'db_only'; dbOnlyQuestionCount += 1; }
      else if (!dbQuestion) { status = 'local_only'; localOnlyQuestionCount += 1; }
      else {
        if (localQuestion.promptSha256 === dbQuestion.promptSha256) {
          status = localQuestion.rawPromptSha256 === dbQuestion.rawPromptSha256
            ? 'exact_prompt' : 'normalized_equivalent_raw_difference';
          if (status === 'exact_prompt') exactQuestionCount += 1;
          else normalizedEquivalentRawDifferenceCount += 1;
        } else { status = 'prompt_conflict'; promptConflictCount += 1; }
        fieldDifferences = SOURCE_FIELDS.flatMap((field) => {
          const localHashes = localQuestion.fieldHashes[field];
          const dbHashes = dbQuestion.fieldHashes[field];
          if (localHashes.rawSha256 === dbHashes.rawSha256) return [];
          const fieldStatus = localHashes.normalizedSha256 === dbHashes.normalizedSha256
            ? 'normalized_equivalent_raw_difference' : 'content_conflict';
          if (fieldStatus === 'content_conflict') fieldConflictCounts[field] += 1;
          return [{
            field,
            status: fieldStatus,
            localNormalizedSha256: localHashes.normalizedSha256,
            dbNormalizedSha256: dbHashes.normalizedSha256
          }];
        });
        const hasContentConflict = fieldDifferences.some((difference) => difference.status === 'content_conflict');
        revisionStatus = hasContentConflict
          ? 'content_conflict'
          : fieldDifferences.length ? 'normalized_equivalent_revision' : 'exact_revision';
        if (revisionStatus === 'exact_revision') exactRevisionCount += 1;
        else if (revisionStatus === 'normalized_equivalent_revision') normalizedEquivalentRevisionCount += 1;
        else contentConflictCount += 1;
      }
      if (status !== 'exact_prompt' || revisionStatus !== 'exact_revision') questionDifferences.push({
        questionNumber, status, revisionStatus,
        localPromptSha256: localQuestion?.promptSha256 ?? null,
        dbPromptSha256: dbQuestion?.promptSha256 ?? null,
        fieldDifferences
      });
    }
    documents.push({
      key,
      status: localDocument && dbDocument ? 'matched_identity' : localDocument ? 'local_only' : 'db_only',
      localFile: localDocument?.file ?? null,
      dbDocumentId: dbDocument ? Number(dbDocument.document.id) : null,
      localQuestionCount: localDocument?.questions.length ?? 0,
      dbQuestionCount: dbDocument?.questions.length ?? 0,
      questionDifferences
    });
  }
  const localCorpus = buildLocalCorpus(workspaceRoot);
  const localSource = localCorpus.controlledInventoryManifest.sources.find((source) => source.sourceId === 'local_repository_source_json');
  const remoteSource = localCorpus.controlledInventoryManifest.sources.find((source) => source.sourceId === 'remote_synced_source_inventory');
  const inventoryManifest = buildSubjectPracticeSourceCorpusInventoryManifest({
    requiredSourceIds: ['local_repository_source_json', 'production_csca_source_questions', 'remote_synced_source_inventory'],
    sources: [localSource, db.sourceInventory, remoteSource]
  });
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    dbInventoryPayloadSha256: db.payloadSha256,
    localCorpusSnapshotSha256: localCorpus.snapshotSha256,
    documentCounts: {
      local: local.length, database: dbDocuments.length,
      matchedIdentity: documents.filter((document) => document.status === 'matched_identity').length,
      localOnly: documents.filter((document) => document.status === 'local_only').length,
      dbOnly: documents.filter((document) => document.status === 'db_only').length
    },
    questionComparison: {
      localCount: local.reduce((sum, document) => sum + document.questions.length, 0),
      databaseCount: db.sourceQuestions.length,
      exactQuestionCount,
      normalizedEquivalentRawDifferenceCount,
      promptConflictCount,
      localOnlyQuestionCount,
      dbOnlyQuestionCount
    },
    fullRevisionComparison: {
      exactRevisionCount,
      normalizedEquivalentRevisionCount,
      contentConflictCount,
      fieldConflictCounts
    },
    documents,
    controlledInventoryManifest: inventoryManifest,
    formalReleaseEligible: false,
    formalReleaseReason: inventoryManifest.coverageStatus === 'partial'
      ? 'remote_synced_source_inventory_missing' : 'reconciliation_does_not_issue_release_attestation',
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_reads_existing_export_only',
    productionImpact: 'none_inventory_reconciliation_only'
  };
  return { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
}

function summaryFor(report) {
  return {
    mode: report.mode, status: 'reconciled_nonqualifying',
    payloadSha256: report.payloadSha256,
    documentCounts: report.documentCounts,
    questionComparison: report.questionComparison,
    fullRevisionComparison: report.fullRevisionComparison,
    inventoryCoverageStatus: report.controlledInventoryManifest.coverageStatus,
    inventoryReasonCodes: report.controlledInventoryManifest.reasonCodes,
    formalReleaseEligible: report.formalReleaseEligible,
    formalReleaseReason: report.formalReleaseReason,
    providerImpact: report.providerImpact, databaseImpact: report.databaseImpact,
    productionImpact: report.productionImpact
  };
}

function selfTest() {
  const payload = {
    mode: 'subject_practice_source_corpus_db_inventory_v2',
    databaseImpact: 'read_only_repeatable_read_transaction',
    documents: [],
    sourceQuestions: []
  };
  const validArtifact = {
    ...payload,
    payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload)))
  };
  const baseQuestionHashes = sourceQuestionFieldHashes({
    prompt: 'Find x.',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
    answer: 'A',
    explanation: 'Substitution gives x = 1.'
  });
  const reorderedOptionKeyHashes = sourceQuestionFieldHashes({
    prompt: 'Find x.',
    options: [{ text: '1', id: 'A' }, { text: '2', id: 'B' }],
    answer: 'A',
    explanation: 'Substitution gives x = 1.',
    localizations: {}
  });
  const changedAnswerHashes = sourceQuestionFieldHashes({
    prompt: 'Find x.',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
    answer: 'B',
    explanation: 'Substitution gives x = 1.'
  });
  const checks = {
    schemaVersionMatchesMode: SCHEMA_VERSION.endsWith('-v3') && MODE.endsWith('_v3'),
    acceptsCanonicalV2DbArtifact: verifyDbArtifact(validArtifact),
    rejectsTamperedDbArtifact: !verifyDbArtifact({ ...validArtifact, sourceQuestions: [{ id: 1 }] }),
    rejectsLegacyDbArtifact: !verifyDbArtifact({ ...validArtifact, mode: 'subject_practice_source_corpus_db_inventory_v1' }),
    documentIdentityIsCaseAndWhitespaceStable:
      documentKey({ subject: ' Math ', examSession: 'APRIL', language: 'EN' }) === 'math|april|en',
    optionObjectKeyOrderCanonicalized: baseQuestionHashes.options.rawSha256
      === reorderedOptionKeyHashes.options.rawSha256,
    missingLocalizationEqualsEmptyObject: baseQuestionHashes.localizations.rawSha256
      === reorderedOptionKeyHashes.localizations.rawSha256,
    nonPromptAnswerDifferenceDetected: baseQuestionHashes.prompt.normalizedSha256
      === changedAnswerHashes.prompt.normalizedSha256
      && baseQuestionHashes.answer.normalizedSha256 !== changedAnswerHashes.answer.normalizedSha256
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-inventory-reconcile-self-test-v3',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    productionImpact: 'none'
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args['self-test']) return selfTest();
  if (!args['db-inventory']) throw new Error('source_corpus_reconcile_db_inventory_required');
  const report = reconcile({ dbInventory: args['db-inventory'] });
  const summary = summaryFor(report);
  if (args.out) {
    const outputPath = workspaceJsonPath(args.out, { mustBeNew: true });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    summary.outputPath = outputPath;
  }
  return summary;
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = {
  MODE, SCHEMA_VERSION,
  argsFrom, workspaceJsonPath, documentKey, sourceQuestionFieldHashes,
  localDocuments, verifyDbArtifact, reconcile, summaryFor, selfTest
};
