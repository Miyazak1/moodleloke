#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  subjectPracticeStructuredSourceQuestionRevisionValid
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const { sha256, payloadValid } = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');
const {
  scoreReviewResponse, verifyReviewAttestation, issueReviewAttestation, fixtureChain
} = require('./csca-subject-practice-source-corpus-translation-human-review.cjs');

const MODE = 'subject_practice_source_corpus_translation_revision_materialize_v1';
const SCHEMA_VERSION = 'subject-practice-source-corpus-translation-revision-materialize-v1';

function text(value) { return String(value ?? '').trim(); }
function list(value) { return String(value ?? '').split(',').map(text).filter(Boolean); }

function lineageParts(sourceLineageKey) {
  const value = text(sourceLineageKey).toLowerCase();
  const separator = value.lastIndexOf('|');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error('source_corpus_translation_revision_lineage_key_invalid');
  }
  return { documentFamilyIdentity: value.slice(0, separator), questionOrdinal: value.slice(separator + 1) };
}

function materializeTranslationRevisions(input) {
  const { prompt, gate, packet, response, score, attestation } = input;
  const rescored = scoreReviewResponse({ packet, response });
  if (!payloadValid(prompt) || !payloadValid(gate) || !payloadValid(packet) || !payloadValid(score)
    || score.payloadSha256 !== rescored.payloadSha256
    || score.status !== 'approved_for_separate_review_attestation'
    || packet.promptPayloadSha256 !== prompt.payloadSha256
    || packet.responseGatePayloadSha256 !== gate.payloadSha256
    || gate.status !== 'ready_for_independent_human_bilingual_review'
    || !verifyReviewAttestation({ packet, response, attestation, secret: input.secret,
      allowedReviewerIds: input.allowedReviewerIds, allowedKeyIds: input.allowedKeyIds, now: input.now })) {
    throw new Error('source_corpus_translation_revision_materialization_input_invalid_or_unattested');
  }
  const materializations = packet.items.map((item) => {
    const parts = lineageParts(item.sourceLineageKey);
    const fields = item.translatedFields;
    const revision = buildSubjectPracticeStructuredSourceQuestionRevision({
      sourceSystem: 'remote_sync',
      documentId: `verified-translation:${parts.documentFamilyIdentity}:${item.targetLanguage}`,
      questionOrdinal: parts.questionOrdinal,
      subject: packet.subject,
      language: item.targetLanguage,
      prompt: fields.prompt,
      options: fields.options,
      answer: fields.correctAnswer,
      explanation: fields.explanation,
      localizations: {
        [item.sourceLanguage]: {
          prompt: item.sourceFields.prompt,
          options: item.sourceFields.options,
          correctAnswer: item.sourceFields.correctAnswer,
          explanation: item.sourceFields.explanation
        }
      },
      documentIdentityHash: sha256(parts.documentFamilyIdentity),
      canonicalTaskParameterFingerprint: null
    });
    if (!subjectPracticeStructuredSourceQuestionRevisionValid(revision)
      || revision.lineageHash !== sha256(`${sha256(parts.documentFamilyIdentity)}:${parts.questionOrdinal}`)
      || revision.language !== item.targetLanguage) {
      throw new Error('source_corpus_translation_revision_materialized_revision_invalid');
    }
    return {
      revision,
      provenance: {
        sourceQuestionRevisionId: revision.sourceQuestionRevisionId,
        sourceLineageKey: item.sourceLineageKey,
        sourceContentSha256: item.sourceContentSha256,
        promptPayloadSha256: prompt.payloadSha256,
        responseGatePayloadSha256: gate.payloadSha256,
        reviewPacketPayloadSha256: packet.payloadSha256,
        reviewScorePayloadSha256: score.payloadSha256,
        reviewAttestationSignature: attestation.signature,
        reviewerId: attestation.reviewerId,
        reviewAttestationExpiresAt: attestation.expiresAt,
        actualCostUsd: gate.actualCostUsd
      }
    };
  });
  const revisions = materializations.map((entry) => entry.revision);
  const revisionProvenance = materializations.map((entry) => entry.provenance);
  if (new Set(revisions.map((revision) => revision.sourceQuestionRevisionId)).size !== revisions.length) {
    throw new Error('source_corpus_translation_revision_materialized_revision_duplicate');
  }
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: 'translated_revisions_materialized_pending_full_corpus_rebuild_and_rescan',
    promptPayloadSha256: prompt.payloadSha256,
    responseGatePayloadSha256: gate.payloadSha256,
    reviewPacketPayloadSha256: packet.payloadSha256,
    reviewScorePayloadSha256: score.payloadSha256,
    reviewAttestationSignature: attestation.signature,
    actualCostUsd: gate.actualCostUsd,
    revisionCount: revisions.length,
    revisions,
    revisionProvenance,
    requiresFullStructuredCorpusRebuild: true,
    requiresFullCorpusRescan: true,
    requiresLengthAxisRecalculation: true,
    sourceCorpusAdmissionEligible: false,
    formalReleaseEligible: false,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false,
    providerImpact: 'none_materialization_only',
    databaseImpact: 'none_no_database_connection',
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
    throw new Error('source_corpus_translation_revision_workspace_json_path_invalid');
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

function preflight(env = process.env) {
  return {
    mode: MODE,
    status: 'preflight_only_no_files_read_or_written',
    reviewSecretConfigured: text(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET).length >= 32,
    reviewerAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS).length > 0,
    keyAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS).length > 0,
    sourceCorpusAdmissionEligible: false,
    providerImpact: 'none', databaseImpact: 'none', publicationImpact: 'none'
  };
}

function execute(input, env = process.env) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const read = (value) => JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, value,
    { mustExist: true }), 'utf8'));
  const artifact = materializeTranslationRevisions({
    prompt: read(input.prompt), gate: read(input.gate), packet: read(input.packet),
    response: read(input.response), score: read(input.score), attestation: read(input.attestation),
    secret: env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET,
    allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS),
    allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS), now: input.now
  });
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
  const input = { prompt: chain.prompt, gate: chain.gate, packet: chain.packet,
    response: chain.response, score, attestation, secret, allowedReviewerIds: ['reviewer-1'],
    allowedKeyIds: ['key-1'], now: '2026-09-14T01:00:00.000Z' };
  const materialized = materializeTranslationRevisions(input);
  const sourceParts = lineageParts(chain.packet.items[0].sourceLineageKey);
  const tamperedAttestation = { ...attestation, signature: `${attestation.signature.slice(0, -1)}0` };
  const checks = {
    validAttestationBuildsFormalRevisionShape: materialized.revisionCount === 1
      && subjectPracticeStructuredSourceQuestionRevisionValid(materialized.revisions[0]),
    translatedRevisionSharesOriginalLineage: materialized.revisions[0].lineageHash
      === sha256(`${sha256(sourceParts.documentFamilyIdentity)}:${sourceParts.questionOrdinal}`),
    targetLanguageAndSourceLocalizationPreserved: materialized.revisions[0].language === 'en'
      && materialized.revisions[0].fields.localizations[0].language === 'zh',
    materializationStillRequiresRebuildAndRescan: materialized.sourceCorpusAdmissionEligible === false
      && materialized.requiresFullStructuredCorpusRebuild === true
      && materialized.requiresFullCorpusRescan === true,
    tamperedAttestationRejected: throws(() => materializeTranslationRevisions({
      ...input, attestation: tamperedAttestation })),
    expiredAttestationRejected: throws(() => materializeTranslationRevisions({
      ...input, now: '2026-09-16T00:00:00.000Z' })),
    preflightHasNoSideEffects: preflight({}).status === 'preflight_only_no_files_read_or_written',
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
      const required = ['prompt', 'gate', 'packet', 'response', 'score', 'attestation', 'now', 'out'];
      if (required.some((key) => !text(args[key]))) {
        throw new Error('source_corpus_translation_revision_execute_inputs_missing');
      }
      report = execute(args);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, SCHEMA_VERSION, lineageParts, materializeTranslationRevisions,
  workspaceJsonPath, argsFrom, preflight, execute, runSelfTest };
