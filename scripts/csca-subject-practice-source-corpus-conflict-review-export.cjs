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
  normalizeSubjectPracticeSourceCorpusText
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  documentKey,
  verifyDbArtifact
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');

const REVIEW_PROTOCOL_VERSION = 'subject-practice-source-corpus-conflict-review-v3';
const SOURCE_FIELDS = Object.freeze(['prompt', 'options', 'answer', 'explanation', 'localizations']);
const DECISION_VALUES = Object.freeze([
  'use_local',
  'use_database',
  'field_by_field',
  'exclude_from_complete_corpus',
  'needs_primary_source_review'
]);

function sha256(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function fieldValue(question, field) {
  if (field === 'prompt') return text(question.promptText ?? question.prompt);
  if (field === 'options') return canonicalJsonValue(question.options ?? []);
  if (field === 'answer') return text(question.correctAnswer ?? question.answer);
  if (field === 'explanation') return text(question.explanation);
  if (field === 'localizations') return canonicalJsonValue(question.localizations ?? {});
  throw new Error('source_corpus_conflict_review_unknown_field');
}

function normalizedFieldValue(value) {
  return normalizeSubjectPracticeSourceCorpusText(
    typeof value === 'string' ? value : JSON.stringify(canonicalJsonValue(value))
  );
}

function differingFields(localQuestion, databaseQuestion) {
  return SOURCE_FIELDS.flatMap((field) => {
    const localValue = fieldValue(localQuestion, field);
    const databaseValue = fieldValue(databaseQuestion, field);
    const localRaw = typeof localValue === 'string' ? localValue : JSON.stringify(localValue);
    const databaseRaw = typeof databaseValue === 'string' ? databaseValue : JSON.stringify(databaseValue);
    if (localRaw === databaseRaw) return [];
    const localNormalized = normalizedFieldValue(localValue);
    const databaseNormalized = normalizedFieldValue(databaseValue);
    return [{
      field,
      status: localNormalized === databaseNormalized
        ? 'normalized_equivalent_raw_difference' : 'content_conflict',
      localSha256: sha256(localRaw),
      databaseSha256: sha256(databaseRaw),
      localValue,
      databaseValue
    }];
  });
}

function revisionContext(question) {
  return Object.fromEntries(SOURCE_FIELDS.map((field) => [field, fieldValue(question, field)]));
}

function priorityFor(fieldDifferences) {
  const conflicts = new Set(fieldDifferences
    .filter((difference) => difference.status === 'content_conflict')
    .map((difference) => difference.field));
  if (conflicts.has('answer')) return 'critical_answer_conflict';
  if (conflicts.has('options')) return 'high_option_conflict';
  if (conflicts.has('prompt')) return 'medium_prompt_conflict';
  return 'low_explanation_or_localization_conflict';
}

function workspaceInputJson(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json') || !fs.existsSync(target)) {
    throw new Error('source_corpus_conflict_review_input_must_be_existing_workspace_json');
  }
  return target;
}

function localDocuments(workspaceRoot) {
  const docsDir = path.resolve(workspaceRoot, 'docs');
  return fs.readdirSync(docsDir).filter((name) => /-source\.json$/i.test(name)
    && name !== 'csca-past-paper-source-json-template.json').sort().map((name) => {
      const filePath = path.join(docsDir, name);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        key: documentKey(parsed.document ?? {}),
        file: `docs/${name}`,
        fileSha256: sha256(raw),
        questions: (parsed.questions ?? []).map((question, index) => ({
          ...question,
          resolvedQuestionNumber: text(question.questionNumber) || String(index + 1)
        }))
      };
    });
}

function buildConflictReviewBatch({ workspaceRoot = process.cwd(), dbInventory }) {
  const dbPath = workspaceInputJson(workspaceRoot, dbInventory);
  const databaseInventory = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (!verifyDbArtifact(databaseInventory)) throw new Error('source_corpus_conflict_review_db_artifact_invalid');
  const local = localDocuments(workspaceRoot);
  const localByKey = new Map(local.map((document) => [document.key, document]));
  const databaseDocuments = databaseInventory.documents.map((document) => ({
    key: documentKey(document),
    documentId: Number(document.id),
    questions: databaseInventory.sourceQuestions.filter((question) =>
      Number(question.documentId) === Number(document.id))
  }));
  const conflicts = [];
  for (const databaseDocument of databaseDocuments) {
    const localDocument = localByKey.get(databaseDocument.key);
    if (!localDocument) continue;
    const localQuestions = new Map(localDocument.questions.map((question) =>
      [question.resolvedQuestionNumber, question]));
    for (const databaseQuestion of databaseDocument.questions) {
      const questionNumber = text(databaseQuestion.questionNumber);
      const localQuestion = localQuestions.get(questionNumber);
      if (!localQuestion) continue;
      const fieldDifferences = differingFields(localQuestion, databaseQuestion);
      if (!fieldDifferences.some((difference) => difference.status === 'content_conflict')) continue;
      const conflictId = `source-conflict-${sha256([
        databaseDocument.key, questionNumber, localDocument.file,
        databaseDocument.documentId, Number(databaseQuestion.id)
      ].join('|')).slice(0, 20)}`;
      conflicts.push({
        conflictId,
        priority: priorityFor(fieldDifferences),
        documentIdentity: databaseDocument.key,
        questionNumber,
        localSourceFile: localDocument.file,
        databaseDocumentId: databaseDocument.documentId,
        databaseQuestionId: Number(databaseQuestion.id),
        differingFields: fieldDifferences,
        localRevisionContext: revisionContext(localQuestion),
        databaseRevisionContext: revisionContext(databaseQuestion),
        recommendedDisposition: 'needs_primary_source_review'
      });
    }
  }
  conflicts.sort((left, right) => left.priority.localeCompare(right.priority)
    || left.documentIdentity.localeCompare(right.documentIdentity)
    || left.questionNumber.localeCompare(right.questionNumber));
  const reviewPacket = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    confidentiality: 'local_internal_source_corpus_review_only_never_send_to_generator_or_student',
    instructions: {
      compareAgainstPrimarySource: true,
      automaticVersionSelectionForbidden: true,
      allowedDecisionValues: DECISION_VALUES,
      decisionAppliesOnlyAfterSeparateValidatedImportStep: true
    },
    conflicts
  };
  const reviewResponseTemplate = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    reviewPacketSha256: sha256(reviewPacket),
    reviewerAttestation: { reviewerId: null, primarySourceConsulted: null, lockedAt: null },
    decisions: conflicts.map((conflict) => ({
      conflictId: conflict.conflictId,
      decision: null,
      fieldDecisions: Object.fromEntries(conflict.differingFields
        .filter((difference) => difference.status === 'content_conflict')
        .map((difference) => [difference.field, null])),
      notes: ''
    }))
  };
  const fieldConflictCounts = Object.fromEntries(SOURCE_FIELDS.map((field) => [field,
    conflicts.filter((conflict) => conflict.differingFields.some((difference) =>
      difference.field === field && difference.status === 'content_conflict')).length
  ]));
  const priorityCounts = Object.fromEntries([
    'critical_answer_conflict', 'high_option_conflict', 'medium_prompt_conflict',
    'low_explanation_or_localization_conflict'
  ].map((priority) => [priority, conflicts.filter((conflict) => conflict.priority === priority).length]));
  const binding = {
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    databaseInventoryPayloadSha256: databaseInventory.payloadSha256,
    localSourceSetSha256: sha256(local.map((document) => [document.file, document.fileSha256])),
    conflictCount: conflicts.length,
    conflictIdSetSha256: sha256(conflicts.map((conflict) => conflict.conflictId)),
    fieldConflictCounts,
    priorityCounts
  };
  const manifest = {
    ...binding,
    batchId: `source-corpus-conflict-review-${sha256(binding).slice(0, 16)}`,
    status: conflicts.length ? 'human_primary_source_review_required' : 'no_content_conflicts_detected',
    reviewPacketSha256: sha256(reviewPacket),
    reviewResponseTemplateSha256: sha256(reviewResponseTemplate),
    automaticResolutionCount: 0,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_existing_export_only',
    publicationImpact: 'none_local_review_packet_only'
  };
  return { manifest, reviewPacket, reviewResponseTemplate };
}

function writeNewReviewDirectory(workspaceRoot, outDir, batch) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(outDir));
  const relative = path.relative(root, target);
  if (!text(outDir) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || target === root) {
    throw new Error('source_corpus_conflict_review_out_dir_must_be_inside_workspace');
  }
  if (fs.existsSync(target)) throw new Error('source_corpus_conflict_review_refuses_to_overwrite');
  fs.mkdirSync(target, { recursive: true });
  const files = {
    manifest: path.join(target, 'manifest.json'),
    reviewPacket: path.join(target, 'review-packet.local-confidential.json'),
    reviewResponseTemplate: path.join(target, 'review-response-template.json')
  };
  fs.writeFileSync(files.manifest, `${JSON.stringify(batch.manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.reviewPacket, `${JSON.stringify(batch.reviewPacket, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.reviewResponseTemplate, `${JSON.stringify(batch.reviewResponseTemplate, null, 2)}\n`, 'utf8');
  return files;
}

function runSelfTest() {
  const base = { prompt: 'Find x.', options: [{ id: 'A', text: '1' }], answer: 'A' };
  const formatOnly = differingFields(base, {
    prompt: ' Find   x. ', options: [{ text: '1', id: 'A' }], answer: 'A', localizations: {}
  });
  const answerConflict = differingFields(base, { ...base, answer: 'B' });
  const answerReviewContext = revisionContext(base);
  const checks = {
    formattingDifferenceIsNotContentConflict: formatOnly.length === 1
      && formatOnly[0].status === 'normalized_equivalent_raw_difference',
    answerConflictDetected: answerConflict.length === 1
      && answerConflict[0].field === 'answer'
      && answerConflict[0].status === 'content_conflict',
    answerConflictHasHighestPriority: priorityFor(answerConflict) === 'critical_answer_conflict',
    answerReviewContextContainsAllFiveFields: SOURCE_FIELDS.every((field) =>
      Object.hasOwn(answerReviewContext, field)),
    decisionSetCannotSilentlyAcceptEitherSide: DECISION_VALUES.includes('needs_primary_source_review')
      && !DECISION_VALUES.includes('auto_accept')
  };
  return {
    mode: 'subject_practice_source_corpus_conflict_review_export_self_test',
    reportVersion: `${REVIEW_PROTOCOL_VERSION}-self-test-v1`,
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
  const dbInventory = argValue('db-inventory');
  if (!dbInventory) throw new Error('source_corpus_conflict_review_db_inventory_required');
  const batch = buildConflictReviewBatch({ dbInventory });
  const outDir = argValue('out-dir');
  const files = outDir ? writeNewReviewDirectory(process.cwd(), outDir, batch) : null;
  return {
    ...batch.manifest,
    mode: outDir
      ? 'subject_practice_source_corpus_conflict_review_export'
      : 'subject_practice_source_corpus_conflict_review_preview',
    files,
    nextAction: outDir
      ? 'Complete review-response-template.json against the primary source; this command never applies decisions.'
      : 'Pass --out-dir=artifacts/<new-directory> to write a non-overwriting local review packet.'
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
  REVIEW_PROTOCOL_VERSION,
  DECISION_VALUES,
  differingFields,
  priorityFor,
  revisionContext,
  buildConflictReviewBatch,
  writeNewReviewDirectory,
  runSelfTest
};
