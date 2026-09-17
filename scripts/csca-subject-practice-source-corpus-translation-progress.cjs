#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { sha256, payloadValid } = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');
const {
  materializeTranslationRevisions
} = require('./csca-subject-practice-source-corpus-translation-revision-materialize.cjs');
const {
  scoreReviewResponse, issueReviewAttestation, fixtureChain
} = require('./csca-subject-practice-source-corpus-translation-human-review.cjs');

const MODE = 'subject_practice_source_corpus_translation_progress_v1';
const SCHEMA_VERSION = 'subject-practice-source-corpus-translation-progress-v1';

function text(value) { return String(value ?? '').trim(); }
function list(value) { return String(value ?? '').split(',').map(text).filter(Boolean); }
function money(value) { return Math.round(Number(value) * 1_000_000) / 1_000_000; }
function jobKey(job) {
  return `${text(job.subject).toLowerCase()}|${text(job.targetLanguage).toLowerCase()}|${text(job.sourceLineageKey).toLowerCase()}`;
}

function buildProgressLedger(input) {
  const workPack = input.workPack;
  if (!payloadValid(workPack)
    || workPack.schemaVersion !== 'subject-practice-source-corpus-translation-work-pack-v1'
    || workPack.status !== 'planned_unexecuted_ready_for_explicit_provider_authorization'
    || workPack.executionAuthorized !== false || !Array.isArray(workPack.translationBatches)) {
    throw new Error('source_corpus_translation_progress_work_pack_invalid');
  }
  const batchById = new Map(workPack.translationBatches.map((batch) => [batch.batchId, batch]));
  const completedBatchIds = new Set();
  const completedJobKeys = new Set();
  let actualCostUsd = 0;
  for (const chain of input.completedChains ?? []) {
    const batchId = text(chain.prompt?.batchId);
    const batch = batchById.get(batchId);
    if (!batch || completedBatchIds.has(batchId)
      || chain.prompt.workPackPayloadSha256 !== workPack.payloadSha256) {
      throw new Error('source_corpus_translation_progress_completed_batch_invalid_or_duplicate');
    }
    const materialized = materializeTranslationRevisions({ ...chain, secret: input.secret,
      allowedReviewerIds: input.allowedReviewerIds, allowedKeyIds: input.allowedKeyIds, now: input.now });
    const expectedKeys = batch.jobs.map(jobKey).sort();
    const provenanceByRevisionId = new Map(materialized.revisionProvenance.map((entry) =>
      [entry.sourceQuestionRevisionId, entry]));
    const actualKeys = materialized.revisions.map((revision) => jobKey({ subject: revision.subject,
      targetLanguage: revision.language,
      sourceLineageKey: provenanceByRevisionId.get(revision.sourceQuestionRevisionId)?.sourceLineageKey })).sort();
    if (materialized.revisionCount !== batch.itemCount
      || JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
      throw new Error('source_corpus_translation_progress_materialized_batch_mismatch');
    }
    for (const key of actualKeys) {
      if (completedJobKeys.has(key)) throw new Error('source_corpus_translation_progress_job_duplicate');
      completedJobKeys.add(key);
    }
    completedBatchIds.add(batchId);
    actualCostUsd = money(actualCostUsd + Number(materialized.actualCostUsd));
  }
  const remainingBatches = workPack.translationBatches.filter((batch) => !completedBatchIds.has(batch.batchId));
  const nextBatch = [...remainingBatches].sort((left, right) => right.itemCount - left.itemCount
    || left.estimatedPromptCharacters - right.estimatedPromptCharacters
    || left.batchId.localeCompare(right.batchId))[0] ?? null;
  const remainingMaximumEstimatedCostUsd = money(remainingBatches
    .reduce((sum, batch) => sum + Number(batch.maxEstimatedCostUsd), 0));
  const projectedTotalCostUpperBoundUsd = money(actualCostUsd + remainingMaximumEstimatedCostUsd);
  const costBudgetStillValid = projectedTotalCostUpperBoundUsd <= workPack.settings.maxEstimatedTotalCostUsd;
  const progressBySubject = ['math', 'physics', 'chemistry'].map((subject) => {
    const subjectBatches = workPack.translationBatches.filter((batch) => batch.subject === subject);
    const completed = subjectBatches.filter((batch) => completedBatchIds.has(batch.batchId));
    return {
      subject,
      totalBatchCount: subjectBatches.length,
      completedBatchCount: completed.length,
      remainingBatchCount: subjectBatches.length - completed.length,
      totalTranslationItemCount: subjectBatches.reduce((sum, batch) => sum + batch.itemCount, 0),
      completedTranslationItemCount: completed.reduce((sum, batch) => sum + batch.itemCount, 0)
    };
  });
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: !costBudgetStillValid ? 'blocked_projected_total_cost_cap_exceeded'
      : remainingBatches.length ? 'translation_batches_remaining' : 'all_translation_batches_attested_and_materialized',
    workPackPayloadSha256: workPack.payloadSha256,
    totalBatchCount: workPack.translationBatchCount,
    completedBatchCount: completedBatchIds.size,
    remainingBatchCount: remainingBatches.length,
    totalTranslationTaskCount: workPack.translationTaskCount,
    completedTranslationTaskCount: completedJobKeys.size,
    remainingTranslationTaskCount: workPack.translationTaskCount - completedJobKeys.size,
    actualCostUsd,
    remainingMaximumEstimatedCostUsd,
    projectedTotalCostUpperBoundUsd,
    declaredTotalCostCapUsd: workPack.settings.maxEstimatedTotalCostUsd,
    costBudgetStillValid,
    completedBatchIds: Array.from(completedBatchIds).sort(),
    nextRecommendedBatch: nextBatch ? {
      batchId: nextBatch.batchId,
      subject: nextBatch.subject,
      targetLanguage: nextBatch.targetLanguage,
      itemCount: nextBatch.itemCount,
      estimatedPromptCharacters: nextBatch.estimatedPromptCharacters,
      maxEstimatedCostUsd: nextBatch.maxEstimatedCostUsd,
      selectionPolicy: 'maximize_items_then_minimize_prompt_characters_then_batch_id'
    } : null,
    progressBySubject,
    sourceCorpusAdmissionEligible: false,
    requiresFullCorpusRebuildAndRescan: completedBatchIds.size > 0,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false,
    providerImpact: 'none_progress_accounting_only',
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot); const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target)) || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_translation_progress_workspace_json_path_invalid');
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
  return { mode: MODE, status: 'preflight_only_no_files_read_or_written',
    completedChainsOptional: true, sourceCorpusAdmissionEligible: false,
    providerImpact: 'none', databaseImpact: 'none', publicationImpact: 'none' };
}

function execute(input, env = process.env) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const read = (value) => JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, value,
    { mustExist: true }), 'utf8'));
  const workPack = read(input.workPack);
  const manifest = input.completionManifest ? read(input.completionManifest) : { entries: [] };
  if (!Array.isArray(manifest.entries)) throw new Error('source_corpus_translation_progress_manifest_invalid');
  const completedChains = manifest.entries.map((entry) => ({
    prompt: read(entry.prompt), gate: read(entry.gate), packet: read(entry.packet),
    response: read(entry.response), score: read(entry.score), attestation: read(entry.attestation)
  }));
  const artifact = buildProgressLedger({ workPack, completedChains,
    secret: env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET,
    allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS),
    allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS), now: input.now });
  const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...artifact, outputPath };
}

function throws(fn) { try { fn(); return false; } catch { return true; } }

function runSelfTest() {
  const chain = fixtureChain();
  const score = scoreReviewResponse(chain);
  const secret = 'fixture-translation-review-secret-1234567890';
  const attestation = issueReviewAttestation({ ...chain, score, secret,
    allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'], keyId: 'key-1',
    issuedAt: '2026-09-14T00:01:00.000Z', expiresAt: '2026-09-15T00:01:00.000Z' });
  const completedChain = { ...chain, score, attestation };
  const base = { workPack: chain.workPack, secret, allowedReviewerIds: ['reviewer-1'],
    allowedKeyIds: ['key-1'], now: '2026-09-14T01:00:00.000Z' };
  const initial = buildProgressLedger({ ...base, completedChains: [] });
  const complete = buildProgressLedger({ ...base, completedChains: [completedChain] });
  const checks = {
    initialLedgerRecommendsUnexecutedBatch: initial.completedBatchCount === 0
      && initial.nextRecommendedBatch.batchId === 'translation-batch-0001',
    attestedMaterializationAloneCountsComplete: complete.completedBatchCount === 1
      && complete.completedTranslationTaskCount === 1
      && complete.status === 'all_translation_batches_attested_and_materialized',
    actualAndRemainingCostRecomputed: complete.actualCostUsd === 0.003
      && complete.remainingMaximumEstimatedCostUsd === 0
      && complete.projectedTotalCostUpperBoundUsd === 0.003,
    duplicateCompletionRejected: throws(() => buildProgressLedger({ ...base,
      completedChains: [completedChain, completedChain] })),
    invalidSignatureRejected: throws(() => buildProgressLedger({ ...base,
      completedChains: [{ ...completedChain, attestation: { ...attestation, signature: '0'.repeat(64) } }] })),
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
      if (![args['work-pack'], args.out].every((value) => text(value))) {
        throw new Error('source_corpus_translation_progress_execute_inputs_missing');
      }
      report = execute({ workPack: args['work-pack'], completionManifest: args['completion-manifest'],
        now: args.now, out: args.out });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, SCHEMA_VERSION, jobKey, buildProgressLedger, workspaceJsonPath,
  argsFrom, preflight, execute, runSelfTest };
