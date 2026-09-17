#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, payloadValid } = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');
const { buildPromptArtifact, fixture: promptFixture } = require(
  './csca-subject-practice-source-corpus-translation-prompt.cjs'
);
const {
  requestItems, assessTranslationResponse, sealedResponse
} = require('./csca-subject-practice-source-corpus-translation-response-gate.cjs');

const MODE = 'subject_practice_source_corpus_translation_human_review_v1';
const PACKET_SCHEMA = 'subject-practice-source-corpus-translation-human-review-packet-v1';
const RESPONSE_SCHEMA = 'subject-practice-source-corpus-translation-human-review-response-v1';
const SCORE_SCHEMA = 'subject-practice-source-corpus-translation-human-review-score-v1';
const ATTESTATION_SCHEMA = 'subject-practice-source-corpus-translation-human-review-attestation-v1';
const MAX_ATTESTATION_HOURS = 168;

function text(value) { return String(value ?? '').trim(); }
function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  return value;
}
function isoMs(value) { const ms = Date.parse(text(value)); return Number.isFinite(ms) ? ms : null; }
function list(value) { return String(value ?? '').split(',').map(text).filter(Boolean); }
function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(canonicalJsonValue(value))).digest('hex');
}

function buildReviewPacket(input) {
  const prompt = input.promptArtifact;
  const gate = input.responseGateArtifact;
  if (!payloadValid(prompt) || !payloadValid(gate)
    || prompt.schemaVersion !== 'subject-practice-source-corpus-translation-prompt-v1'
    || gate.schemaVersion !== 'subject-practice-source-corpus-translation-response-gate-v1'
    || gate.status !== 'ready_for_independent_human_bilingual_review'
    || gate.promptPayloadSha256 !== prompt.payloadSha256
    || gate.providerRequestSha256 !== prompt.providerRequestSha256
    || gate.itemCount !== gate.assessments?.length) {
    throw new Error('source_corpus_translation_human_review_input_invalid_or_unbound');
  }
  const sourceItems = requestItems(prompt);
  const sourceById = new Map(sourceItems.map((item) => [item.itemId, item]));
  const items = gate.assessments.map((assessment) => {
    const source = sourceById.get(assessment.itemId);
    if (!source || assessment.status !== 'deterministic_checks_passed_pending_human_review'
      || !assessment.translatedFields) {
      throw new Error('source_corpus_translation_human_review_item_not_deterministically_qualified');
    }
    return {
      itemId: assessment.itemId,
      sourceLineageKey: source.sourceLineageKey,
      sourceContentSha256: source.sourceContentSha256,
      sourceLanguage: source.sourceLanguage,
      targetLanguage: source.targetLanguage,
      sourceFields: canonicalJsonValue({ prompt: source.prompt, options: source.options,
        correctAnswer: source.correctAnswer, explanation: source.explanation }),
      translatedFields: assessment.translatedFields,
      deterministicChecks: assessment.checks
    };
  });
  const payload = {
    schemaVersion: PACKET_SCHEMA,
    mode: MODE,
    status: 'awaiting_independent_human_bilingual_review',
    promptPayloadSha256: prompt.payloadSha256,
    responseGatePayloadSha256: gate.payloadSha256,
    responseEnvelopePayloadSha256: gate.responseEnvelopePayloadSha256,
    batchId: gate.batchId,
    subject: prompt.subject,
    sourceLanguage: items[0]?.sourceLanguage,
    targetLanguage: prompt.targetLanguage,
    itemCount: items.length,
    items,
    reviewerRequirements: {
      role: 'independent_bilingual_subject_reviewer',
      mustNotBeProviderSelfReview: true,
      mustReviewExactBoundSourceAndTranslation: true,
      semanticEquivalenceRequired: true,
      scientificCorrectnessRequired: true,
      notationPreservationRequired: true,
      optionMeaningPreservationRequired: true
    },
    responseTemplate: {
      schemaVersion: RESPONSE_SCHEMA,
      packetPayloadSha256: 'copy_packet_payload_sha256_here',
      reviewerId: '', reviewerRole: 'independent_bilingual_subject_reviewer', lockedAt: '',
      decisions: items.map((item) => ({ itemId: item.itemId, decision: null,
        semanticEquivalent: null, scientificCorrect: null, notationPreserved: null,
        optionMeaningPreserved: null, notes: '' }))
    },
    sourceCorpusAdmissionEligible: false,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function scoreReviewResponse(input) {
  const packet = input.packet;
  const response = input.response;
  if (!payloadValid(packet) || packet.schemaVersion !== PACKET_SCHEMA
    || packet.status !== 'awaiting_independent_human_bilingual_review'
    || !response || response.schemaVersion !== RESPONSE_SCHEMA
    || response.packetPayloadSha256 !== packet.payloadSha256
    || text(response.reviewerRole) !== 'independent_bilingual_subject_reviewer'
    || !text(response.reviewerId) || isoMs(response.lockedAt) === null
    || !Array.isArray(response.decisions) || response.decisions.length !== packet.itemCount) {
    throw new Error('source_corpus_translation_human_review_response_invalid_or_unbound');
  }
  const expectedIds = packet.items.map((item) => item.itemId);
  const decisionIds = response.decisions.map((decision) => text(decision.itemId));
  if (new Set(decisionIds).size !== decisionIds.length
    || decisionIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error('source_corpus_translation_human_review_decision_set_or_order_invalid');
  }
  const scoredDecisions = response.decisions.map((decision) => {
    const flags = ['semanticEquivalent', 'scientificCorrect', 'notationPreserved',
      'optionMeaningPreserved'];
    if (!['approve', 'reject'].includes(decision.decision)
      || flags.some((key) => typeof decision[key] !== 'boolean')) {
      throw new Error('source_corpus_translation_human_review_decision_invalid');
    }
    const allPassed = flags.every((key) => decision[key] === true);
    if ((decision.decision === 'approve' && !allPassed)
      || (decision.decision === 'reject' && (!text(decision.notes) || allPassed))) {
      throw new Error('source_corpus_translation_human_review_decision_inconsistent');
    }
    return { itemId: decision.itemId, decision: decision.decision, allReviewDimensionsPassed: allPassed,
      notes: text(decision.notes) };
  });
  const allApproved = scoredDecisions.every((decision) => decision.decision === 'approve');
  const responsePayloadSha256 = sha256(canonicalJsonValue(response));
  const payload = {
    schemaVersion: SCORE_SCHEMA,
    mode: MODE,
    status: allApproved ? 'approved_for_separate_review_attestation' : 'rejected_by_human_review',
    packetPayloadSha256: packet.payloadSha256,
    responsePayloadSha256,
    reviewerId: text(response.reviewerId),
    reviewerRole: response.reviewerRole,
    lockedAt: new Date(isoMs(response.lockedAt)).toISOString(),
    itemCount: scoredDecisions.length,
    approvedItemCount: scoredDecisions.filter((decision) => decision.decision === 'approve').length,
    decisions: scoredDecisions,
    attestationIssued: false,
    sourceCorpusAdmissionEligible: false,
    requiresSeparateAttestation: allApproved,
    requiresStructuredRevisionRebuild: allApproved,
    requiresCorpusRescan: allApproved,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function issueReviewAttestation(input) {
  const { packet, response, score } = input;
  const secret = text(input.secret);
  const allowedReviewerIds = new Set(input.allowedReviewerIds ?? []);
  const allowedKeyIds = new Set(input.allowedKeyIds ?? []);
  const issuedAtMs = isoMs(input.issuedAt); const expiresAtMs = isoMs(input.expiresAt);
  const rescored = scoreReviewResponse({ packet, response });
  if (secret.length < 32 || !allowedReviewerIds.has(score?.reviewerId)
    || !allowedKeyIds.has(text(input.keyId)) || !payloadValid(score)
    || score.payloadSha256 !== rescored.payloadSha256
    || score.status !== 'approved_for_separate_review_attestation'
    || issuedAtMs === null || expiresAtMs === null || issuedAtMs < isoMs(score.lockedAt)
    || expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > MAX_ATTESTATION_HOURS * 3_600_000) {
    throw new Error('source_corpus_translation_human_review_attestation_issue_rejected');
  }
  const body = {
    schemaVersion: ATTESTATION_SCHEMA,
    packetPayloadSha256: packet.payloadSha256,
    responsePayloadSha256: score.responsePayloadSha256,
    scorePayloadSha256: score.payloadSha256,
    reviewerId: score.reviewerId,
    keyId: text(input.keyId),
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    itemCount: score.itemCount,
    status: 'human_review_attested_pending_structured_rebuild_and_rescan',
    sourceCorpusAdmissionEligible: false,
    requiresStructuredRevisionRebuild: true,
    requiresCorpusRescan: true,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false
  };
  return { ...body, signature: hmac(secret, body) };
}

function verifyReviewAttestation(input) {
  try {
    const { attestation } = input;
    const rescored = scoreReviewResponse({ packet: input.packet, response: input.response });
    const { signature, ...body } = attestation ?? {};
    const nowMs = isoMs(input.now);
    return Boolean(attestation?.schemaVersion === ATTESTATION_SCHEMA
      && input.allowedReviewerIds?.includes(attestation.reviewerId)
      && input.allowedKeyIds?.includes(attestation.keyId)
      && attestation.packetPayloadSha256 === input.packet.payloadSha256
      && attestation.scorePayloadSha256 === rescored.payloadSha256
      && attestation.responsePayloadSha256 === rescored.responsePayloadSha256
      && attestation.sourceCorpusAdmissionEligible === false
      && nowMs !== null && nowMs >= isoMs(attestation.issuedAt) && nowMs < isoMs(attestation.expiresAt)
      && /^[a-f0-9]{64}$/.test(signature)
      && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hmac(input.secret, body), 'hex')));
  } catch { return false; }
}

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot); const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target)) || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_translation_human_review_workspace_json_path_invalid');
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

function executeMode(args, env = process.env, workspaceRoot = process.cwd()) {
  const read = (value) => JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, value,
    { mustExist: true }), 'utf8'));
  const write = (value) => {
    if (!text(args.out)) throw new Error('source_corpus_translation_human_review_output_required');
    const outputPath = workspaceJsonPath(workspaceRoot, args.out, { mustBeNew: true });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { ...value, outputPath };
  };
  if (args['export-packet']) {
    return write(buildReviewPacket({ promptArtifact: read(args.prompt),
      responseGateArtifact: read(args.gate) }));
  }
  if (args['score-response']) {
    return write(scoreReviewResponse({ packet: read(args.packet), response: read(args.response) }));
  }
  if (args['issue-attestation']) {
    return write(issueReviewAttestation({ packet: read(args.packet), response: read(args.response),
      score: read(args.score), secret: env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET,
      allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS),
      allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS),
      keyId: args['key-id'], issuedAt: args['issued-at'], expiresAt: args['expires-at'] }));
  }
  if (args['verify-attestation']) {
    const verified = verifyReviewAttestation({ packet: read(args.packet), response: read(args.response),
      attestation: read(args.attestation), secret: env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET,
      allowedReviewerIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS),
      allowedKeyIds: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS), now: args.now });
    return { mode: MODE, status: verified ? 'attestation_verified' : 'attestation_rejected',
      verified, sourceCorpusAdmissionEligible: false, databaseWriteAllowed: false,
      studentPublicationAllowed: false };
  }
  return preflight(env);
}

function preflight(env = process.env) {
  return { mode: MODE, status: 'preflight_only_no_files_read_or_written',
    reviewSecretConfigured: text(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_HMAC_SECRET).length >= 32,
    reviewerAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEWER_IDS).length > 0,
    keyAllowlistConfigured: list(env.CSCA_SOURCE_CORPUS_TRANSLATION_REVIEW_KEY_IDS).length > 0,
    sourceCorpusAdmissionEligible: false, providerImpact: 'none', databaseImpact: 'none',
    publicationImpact: 'none' };
}

function fixtureChain() {
  const { record, workPack } = promptFixture();
  const prompt = buildPromptArtifact({ workPack, batchId: 'translation-batch-0001',
    localRecords: [record], databaseRecords: [], model: 'fixture-model', maxOutputTokens: 3000 });
  const source = requestItems(prompt)[0];
  const translated = { itemId: source.itemId, targetLanguage: 'en',
    prompt: 'At 25 °C, which statement about H2O is correct?',
    options: [{ id: 'A', text: 'Statement A' }, { id: 'B', text: 'Statement B' }],
    correctAnswer: 'A', explanation: 'At 25 °C, statement A matches the definition of H2O.' };
  const gate = assessTranslationResponse({ promptArtifact: prompt,
    responseEnvelope: sealedResponse(prompt, [translated]) });
  const packet = buildReviewPacket({ promptArtifact: prompt, responseGateArtifact: gate });
  const response = { schemaVersion: RESPONSE_SCHEMA, packetPayloadSha256: packet.payloadSha256,
    reviewerId: 'reviewer-1', reviewerRole: 'independent_bilingual_subject_reviewer',
    lockedAt: '2026-09-14T00:00:00.000Z', decisions: packet.items.map((item) => ({ itemId: item.itemId,
      decision: 'approve', semanticEquivalent: true, scientificCorrect: true,
      notationPreserved: true, optionMeaningPreserved: true, notes: '' })) };
  return { prompt, gate, packet, response, workPack };
}

function throws(fn) { try { fn(); return false; } catch { return true; } }

function runSelfTest() {
  const chain = fixtureChain();
  const score = scoreReviewResponse(chain);
  const secret = 'fixture-translation-review-secret-1234567890';
  const attestation = issueReviewAttestation({ ...chain, score, secret,
    allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'], keyId: 'key-1',
    issuedAt: '2026-09-14T00:01:00.000Z', expiresAt: '2026-09-15T00:01:00.000Z' });
  const rejectedResponse = { ...chain.response, decisions: chain.response.decisions.map((decision) => ({
    ...decision, decision: 'reject', semanticEquivalent: false, notes: 'Meaning changed.' })) };
  const tamperedPacket = { ...chain.packet, subject: 'math' };
  const checks = {
    packetShowsBoundSourceAndTranslation: chain.packet.items.every((item) =>
      item.sourceFields && item.translatedFields && /^[a-f0-9]{64}$/.test(item.sourceContentSha256)),
    completeApprovalOnlyRequestsSeparateAttestation: score.status === 'approved_for_separate_review_attestation'
      && score.sourceCorpusAdmissionEligible === false,
    rejectionCannotBeAttested: scoreReviewResponse({ packet: chain.packet,
      response: rejectedResponse }).status === 'rejected_by_human_review'
      && throws(() => issueReviewAttestation({ packet: chain.packet, response: rejectedResponse,
        score: scoreReviewResponse({ packet: chain.packet, response: rejectedResponse }), secret,
        allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'], keyId: 'key-1',
        issuedAt: '2026-09-14T00:01:00.000Z', expiresAt: '2026-09-15T00:01:00.000Z' })),
    signedAttestationReverifies: verifyReviewAttestation({ ...chain, attestation, secret,
      allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'], now: '2026-09-14T01:00:00.000Z' }),
    tamperedPacketRejected: !verifyReviewAttestation({ ...chain, packet: tamperedPacket,
      attestation, secret, allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'],
      now: '2026-09-14T01:00:00.000Z' }),
    unauthorizedReviewerRejected: throws(() => issueReviewAttestation({ ...chain, score, secret,
      allowedReviewerIds: ['other'], allowedKeyIds: ['key-1'], keyId: 'key-1',
      issuedAt: '2026-09-14T00:01:00.000Z', expiresAt: '2026-09-15T00:01:00.000Z' })),
    expiredAttestationRejected: !verifyReviewAttestation({ ...chain, attestation, secret,
      allowedReviewerIds: ['reviewer-1'], allowedKeyIds: ['key-1'], now: '2026-09-16T00:00:00.000Z' }),
    preflightHasNoSideEffects: preflight({}).status === 'preflight_only_no_files_read_or_written',
    pathEscapeRejected: throws(() => workspaceJsonPath(process.cwd(), '../outside.json', { mustBeNew: true }))
  };
  return { mode: `${MODE}_self_test`, reportVersion: `${MODE}-self-test-v1`,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_fixture_only', publicationImpact: 'none' };
}

if (require.main === module) {
  try {
    const args = argsFrom(process.argv.slice(2));
    const report = args['self-test'] ? runSelfTest() : executeMode(args);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, PACKET_SCHEMA, RESPONSE_SCHEMA, SCORE_SCHEMA, ATTESTATION_SCHEMA,
  buildReviewPacket, scoreReviewResponse, issueReviewAttestation, verifyReviewAttestation,
  fixtureChain, workspaceJsonPath, argsFrom, executeMode, preflight, runSelfTest };
