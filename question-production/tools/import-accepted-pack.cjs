#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = Object.freeze({ math: 10, physics: 10, chemistry: 10 });
const REVIEW_NAMESPACE = 'dualSessionSupervisedAcceptance';
const APPLY_CONFIRMATION = 'APPLY_DUAL_SESSION_SUPERVISED_PACK';
const APPROXIMATE_THRESHOLD = 0.82;

function parseArgs(argv) {
  const args = { apply: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--json') args.json = true;
    else if (['--pack', '--db-fixture', '--confirm'].includes(token)) args[token.slice(2).replace('-', '_')] = argv[++i];
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function normalizedText(value) { return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/[，。！？；：“”‘’、,.!?;:'"`()\[\]{}]/g, ''); }
function normalizedOptions(options) { return (Array.isArray(options) ? options : []).map((option) => ({ id: String(option?.id ?? ''), text: normalizedText(option?.text ?? option) })); }
function fingerprints(question) {
  const prompt = normalizedText(question.prompt);
  const options = normalizedOptions(question.options);
  return { prompt, options, promptHash: sha256(prompt), optionsHash: sha256(stable(options)), contentHash: sha256(stable({ prompt, options })) };
}
function trigrams(value) {
  const text = `  ${normalizedText(value)}  `;
  const out = new Set();
  for (let i = 0; i < text.length - 2; i += 1) out.add(text.slice(i, i + 3));
  return out;
}
function jaccard(left, right) {
  const a = trigrams(left); const b = trigrams(right); let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return a.size || b.size ? intersection / (a.size + b.size - intersection) : 1;
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot parse JSON ${file}: ${error.message}`); }
}
function loadPack(packPath) {
  const resolved = path.resolve(packPath);
  if (fs.statSync(resolved).isFile()) {
    const pack = readJson(resolved);
    for (const key of ['selection', 'manifest', 'questions', 'reviews', 'audit']) if (!(key in pack)) throw new Error(`Pack JSON is missing top-level ${key}`);
    return { root: path.dirname(resolved), ...pack };
  }
  const names = { selection: ['selection.json', 'selection-plan.json'], manifest: ['manifest.json', 'accepted-manifest.json'], questions: ['questions.json'], reviews: ['reviews.json'], audit: ['audit.json', path.join('audit', 'originality-audit.json')] };
  const pack = { root: resolved };
  for (const [key, candidates] of Object.entries(names)) {
    const file = candidates.map((name) => path.join(resolved, name)).find(fs.existsSync);
    if (!file) throw new Error(`Pack directory is missing ${key} (${candidates.join(' or ')})`);
    pack[key] = readJson(file);
  }
  const topicMappingFile = path.join(resolved, 'topic-mapping.json');
  if (fs.existsSync(topicMappingFile)) { pack.topicMapping = readJson(topicMappingFile); pack.topicMappingEvidence = { path: topicMappingFile, sha256: sha256(fs.readFileSync(topicMappingFile)) }; }
  const topicMappingProposalFile = path.join(resolved, 'topic-mapping-proposal.json');
  if (fs.existsSync(topicMappingProposalFile)) { pack.topicMappingProposal = readJson(topicMappingProposalFile); pack.topicMappingProposalEvidence = { path: topicMappingProposalFile, sha256: sha256(fs.readFileSync(topicMappingProposalFile)) }; }
  return pack;
}
function asArray(value, name) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[name])) return value[name];
  throw new Error(`${name} must be an array or contain an array named ${name}`);
}
function auditEntries(audit) { return Array.isArray(audit.questions) ? audit.questions : Array.isArray(audit.entries) ? audit.entries : []; }

function validatePack(pack) {
  const errors = []; const warnings = [];
  const questions = asArray(pack.questions, 'questions'); const reviews = asArray(pack.reviews, 'reviews');
  const selected = Array.isArray(pack.selection?.candidates) ? pack.selection.candidates.map((entry) => typeof entry === 'string' ? entry : entry.candidateId) : pack.selection?.candidateIds;
  const manifestIds = pack.manifest?.candidateIds ?? pack.manifest?.selectedCandidateIds;
  if (!Array.isArray(selected)) errors.push('selection must list candidates/candidateIds');
  if (!Array.isArray(manifestIds)) errors.push('manifest must list candidateIds/selectedCandidateIds');
  const questionIds = questions.map((question) => question.candidateId);
  const selectionById = new Map((pack.selection?.candidates ?? []).filter((entry) => entry && typeof entry === 'object').map((entry) => [entry.candidateId, entry]));
  const approvedMappingById = new Map();
  if (pack.topicMapping) {
    if (pack.topicMapping.status !== 'approved_by_supervisor') errors.push('topic-mapping.json must have status=approved_by_supervisor; proposal-only mappings cannot authorize import');
    if (!pack.topicMapping.scope || !pack.topicMapping.approvedAt || !pack.topicMapping.proposalSha256) errors.push('topic-mapping.json must record scope, approvedAt, and proposalSha256');
    if (!pack.topicMappingProposalEvidence || pack.topicMapping.proposalSha256 !== pack.topicMappingProposalEvidence.sha256) errors.push('topic-mapping.json proposalSha256 does not match topic-mapping-proposal.json');
    const proposalById = new Map((pack.topicMappingProposal?.mappings ?? []).map((entry) => [entry.candidateId, entry]));
    for (const entry of pack.topicMapping.mappings ?? []) {
      if (approvedMappingById.has(entry.candidateId)) errors.push(`${entry.candidateId}: duplicate topic mapping entry`);
      if (entry.scope !== pack.topicMapping.scope || entry.approvedAt !== pack.topicMapping.approvedAt || entry.proposalDigest !== pack.topicMapping.proposalSha256) errors.push(`${entry.candidateId}: mapping approval evidence does not match file-level approval`);
      const proposed = proposalById.get(entry.candidateId);
      const approvedPair = [entry.originalTopicCode, entry.mappedTopicCode, Number(entry.mappedTopicId), Number(entry.specialPracticeTopicId), entry.specialPracticeTopicSlug, entry.rationale];
      const proposedPair = proposed ? [proposed.originalTopicCode, proposed.mappedTopicCode, Number(proposed.mappedTopicId), Number(proposed.specialPracticeTopicId), proposed.specialPracticeTopicSlug, proposed.rationale] : null;
      if (!proposed || proposed.mappingStatus !== 'proposed' || stable(approvedPair) !== stable(proposedPair)) errors.push(`${entry.candidateId}: approved pair differs from the digested proposal`);
      approvedMappingById.set(entry.candidateId, entry);
    }
  }
  const reviewById = new Map(reviews.map((review) => [review.candidateId, review]));
  const entries = auditEntries(pack.audit); const auditById = new Map(entries.map((entry) => [entry.candidateId, entry]));
  if (questions.length !== 30) errors.push(`expected 30 questions, found ${questions.length}`);
  if (new Set(questionIds).size !== questions.length) errors.push('candidateId values are not unique');
  for (const [subject, expected] of Object.entries(EXPECTED)) {
    const actual = questions.filter((question) => question.subject === subject).length;
    if (actual !== expected) errors.push(`expected ${expected} ${subject} questions, found ${actual}`);
  }
  for (const [label, ids] of [['selection', selected], ['manifest', manifestIds]]) if (Array.isArray(ids) && stable([...ids].sort()) !== stable([...questionIds].sort())) errors.push(`${label} candidate IDs do not exactly match questions`);
  if (pack.audit?.formalQualificationEligible === false) warnings.push('audit.formalQualificationEligible=false records that originality audit alone cannot authorize publication; per-candidate clear status remains mandatory');
  if (entries.length !== questions.length) errors.push(`audit must contain one entry per question; found ${entries.length}`);
  const promptHashes = new Map(); const optionHashes = new Map(); const contentHashes = new Map(); const prepared = [];
  for (const question of questions) {
    const id = question.candidateId;
    if (!id || !Object.hasOwn(EXPECTED, question.subject)) errors.push(`invalid candidate identity/subject: ${id ?? '<missing>'}`);
    if (!question.topicCode) errors.push(`${id}: topicCode is required`);
    if (!Array.isArray(question.options) || question.options.length !== 4) errors.push(`${id}: exactly four options are required`);
    if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) errors.push(`${id}: correctAnswer must be A-D`);
    const review = reviewById.get(id);
    if (!review) errors.push(`${id}: review missing`);
    else {
      const verdict = String(review.verdictAfterReveal ?? review.finalVerdict ?? review.verdictBeforeReveal ?? review.status ?? '').toLowerCase();
      if (!['pass', 'passed', 'accepted'].includes(verdict)) errors.push(`${id}: review is not pass`);
      if (review.derivedAnswer !== question.correctAnswer) errors.push(`${id}: generator answer ${question.correctAnswer} differs from reviewer answer ${review.derivedAnswer}`);
      if (review.generatorAnswer != null && review.generatorAnswer !== question.correctAnswer) errors.push(`${id}: recorded generatorAnswer is inconsistent`);
      if (review.answersConsistent === false) errors.push(`${id}: post-reveal answer consistency failed`);
    }
    const audit = auditById.get(id);
    if (!audit) errors.push(`${id}: audit entry missing`);
    else if (String(audit.status ?? '').toLowerCase() !== 'clear') errors.push(`${id}: audit status must be clear; found ${audit.status ?? 'missing'}`);
    const fp = fingerprints(question);
    for (const [map, hash, label] of [[promptHashes, fp.promptHash, 'prompt'], [optionHashes, fp.optionsHash, 'options'], [contentHashes, fp.contentHash, 'content']]) {
      if (map.has(hash)) errors.push(`${id}: duplicate ${label} hash with ${map.get(hash)}`); else map.set(hash, id);
    }
    const selectionEntry = selectionById.get(id);
    const approvedMapping = approvedMappingById.get(id);
    const selectionOverride = selectionEntry?.topicCodeOverride;
    const fileOverride = approvedMapping?.mappingStatus === 'approved' ? approvedMapping.mappedTopicCode : null;
    if (selectionOverride && fileOverride && selectionOverride !== fileOverride) errors.push(`${id}: selection topicCodeOverride conflicts with topic-mapping.json`);
    if (pack.topicMapping && (!approvedMapping || approvedMapping.mappingStatus !== 'approved' || !approvedMapping.mappedTopicCode || !Number.isInteger(Number(approvedMapping.mappedTopicId)) || !Number.isInteger(Number(approvedMapping.specialPracticeTopicId)))) errors.push(`${id}: approved topic-mapping.json lacks an approved mapped topic pair`);
    if (approvedMapping?.originalTopicCode && approvedMapping.originalTopicCode !== question.topicCode) errors.push(`${id}: topic-mapping.json originalTopicCode does not match question`);
    const mappedTopicCode = selectionOverride || fileOverride || question.topicCode;
    prepared.push({ ...question, originalTopicCode: question.topicCode, mappedTopicCode, approvedTopicMapping: approvedMapping?.mappingStatus === 'approved' ? { ...approvedMapping, approvalStatus: pack.topicMapping?.status ?? null, proposalSha256: pack.topicMapping?.proposalSha256 ?? null } : null, review, audit, fingerprints: fp, idempotencyKey: `${id}:${fp.contentHash}` });
  }
  if (reviews.length !== questions.length) errors.push(`reviews count ${reviews.length} does not match questions count ${questions.length}`);
  const packId = String(pack.manifest?.packId ?? pack.manifest?.selectionId ?? pack.selection?.selectionId ?? '');
  if (!packId) errors.push('manifest/selection must define a stable packId or selectionId');
  if (pack.topicMapping?.packId && pack.topicMapping.packId !== packId) errors.push('topic-mapping.json packId does not match accepted pack');
  const computedQuestionsDigest = sha256(stable(questions));
  if (pack.manifest?.questionsSha256 && pack.manifest.questionsSha256 !== computedQuestionsDigest) errors.push('manifest questionsSha256 does not match canonical questions payload');
  return { errors, warnings, prepared, packId, computedQuestionsDigest, approvalFileEvidence: { topicMapping: pack.topicMappingEvidence ?? null, proposal: pack.topicMappingProposalEvidence ?? null } };
}

function compareWithInventory(prepared, inventory) {
  const exact = []; const approximate = []; const idempotentExisting = []; const bridgeWillBeCreatedByPair = new Map();
  const topicMap = new Map((inventory.cscaExamTopics ?? []).map((topic) => [`${topic.subject}:${topic.code}`, topic]));
  const spTopicByExamId = new Map((inventory.topicMappings ?? []).filter((row) => row.sourceType === 'special_practice_topic').map((row) => [Number(row.topicId), Number(row.sourceId)]));
  const spTopics = new Map((inventory.specialPracticeTopics ?? []).map((topic) => [Number(topic.id), topic]));
  const missingTopics = [];
  const existing = [...(inventory.cscaQuestions ?? []).map((row) => ({ ...row, table: 'csca_questions' })), ...(inventory.specialPracticeQuestions ?? []).map((row) => ({ ...row, table: 'special_practice_questions' }))];
  for (const candidate of prepared) {
    const topic = topicMap.get(`${candidate.subject}:${candidate.mappedTopicCode}`);
    const acceptedSpecialPracticeTopicId = candidate.approvedTopicMapping ? Number(candidate.approvedTopicMapping.specialPracticeTopicId) : null;
    const specialPracticeTopicId = acceptedSpecialPracticeTopicId ?? (topic ? spTopicByExamId.get(Number(topic.id)) : null);
    const specialPracticeTopic = specialPracticeTopicId ? spTopics.get(specialPracticeTopicId) : null;
    const approvedPairMatches = !candidate.approvedTopicMapping
      || ((!candidate.approvedTopicMapping.mappedTopicId || Number(candidate.approvedTopicMapping.mappedTopicId) === Number(topic?.id))
        && (!candidate.approvedTopicMapping.specialPracticeTopicSlug || candidate.approvedTopicMapping.specialPracticeTopicSlug === specialPracticeTopic?.slug));
    const databaseBridgeExists = Boolean(topic && specialPracticeTopicId && (inventory.topicMappings ?? []).some((row) => row.sourceType === 'special_practice_topic' && Number(row.topicId) === Number(topic.id) && Number(row.sourceId) === Number(specialPracticeTopicId)));
    const usableMapping = topic && specialPracticeTopic && approvedPairMatches && topic.status === 'published' && specialPracticeTopic.status === 'published' && specialPracticeTopic.subject === candidate.subject;
    candidate.mapping = usableMapping ? { examTopicId: Number(topic.id), specialPracticeTopicId, source: candidate.approvedTopicMapping ? 'approved_topic_mapping_file' : 'database_csca_topic_mappings', databaseBridgeExists, examTopic: topic, specialPracticeTopic } : null;
    if (!candidate.mapping) missingTopics.push({ candidateId: candidate.candidateId, subject: candidate.subject, originalTopicCode: candidate.originalTopicCode, mappedTopicCode: candidate.mappedTopicCode, reason: !topic ? 'csca_exam_topic_missing' : 'special_practice_topic_mapping_missing' });
    else if (candidate.approvedTopicMapping && !databaseBridgeExists) {
      const bridgeKey = `${Number(topic.id)}:${Number(specialPracticeTopicId)}`;
      const bridge = bridgeWillBeCreatedByPair.get(bridgeKey) ?? { candidateIds: [], subject: candidate.subject, mappedTopicCode: candidate.mappedTopicCode, examTopicId: Number(topic.id), specialPracticeTopicId: Number(specialPracticeTopicId), approvalScope: candidate.approvedTopicMapping.scope, proposalSha256: candidate.approvedTopicMapping.proposalSha256 };
      bridge.candidateIds.push(candidate.candidateId); bridgeWillBeCreatedByPair.set(bridgeKey, bridge);
    }
    const sameImportRows = (inventory.cscaQuestions ?? []).filter((row) => row.reviewMetadata?.[REVIEW_NAMESPACE]?.idempotencyKey === candidate.idempotencyKey);
    const linkedSpecialPracticeIds = new Set(sameImportRows.map((row) => Number(row.sourceQuestionId)).filter(Number.isInteger));
    if (sameImportRows.length) idempotentExisting.push(...sameImportRows.map((row) => ({ candidateId: candidate.candidateId, cscaQuestionId: row.id, specialPracticeQuestionId: row.sourceQuestionId ?? null })));
    for (const row of existing) {
      if ((row.table === 'csca_questions' && sameImportRows.some((item) => item.id === row.id)) || (row.table === 'special_practice_questions' && linkedSpecialPracticeIds.has(Number(row.id)))) continue;
      const fp = fingerprints(row); const reasons = [];
      if (candidate.fingerprints.promptHash === fp.promptHash) reasons.push('exact_prompt');
      if (candidate.fingerprints.contentHash === fp.contentHash) reasons.push('exact_prompt_options');
      if (reasons.length) exact.push({ candidateId: candidate.candidateId, table: row.table, id: row.id, reasons });
      else { const similarity = jaccard(candidate.prompt, row.prompt); if (similarity >= APPROXIMATE_THRESHOLD) approximate.push({ candidateId: candidate.candidateId, table: row.table, id: row.id, promptSimilarity: Number(similarity.toFixed(4)) }); }
    }
  }
  return { exact, approximate: approximate.sort((a, b) => b.promptSimilarity - a.promptSimilarity), bridgeWillBeCreated: [...bridgeWillBeCreatedByPair.values()], idempotentExisting, missingTopics };
}

function lockedRevalidation(prepared, inventory) {
  const fullReport = compareWithInventory(prepared, inventory);
  const specialPracticeIds = new Set((inventory.specialPracticeQuestions ?? []).map((row) => Number(row.id)));
  const idempotencyRows = new Map();
  for (const row of fullReport.idempotentExisting) {
    const rows = idempotencyRows.get(row.candidateId) ?? [];
    rows.push(row); idempotencyRows.set(row.candidateId, rows);
  }
  const completeIdempotentIds = new Set();
  const blockers = [];
  for (const [candidateId, rows] of idempotencyRows) {
    if (rows.length !== 1) blockers.push(`${candidateId}: ${rows.length} rows share the idempotency key`);
    else if (!Number.isInteger(Number(rows[0].specialPracticeQuestionId)) || !specialPracticeIds.has(Number(rows[0].specialPracticeQuestionId))) blockers.push(`${candidateId}: idempotent csca row lacks its linked special-practice row`);
    else completeIdempotentIds.add(candidateId);
  }
  const isPending = (item) => !completeIdempotentIds.has(item.candidateId);
  const report = {
    ...fullReport,
    exact: fullReport.exact.filter(isPending),
    approximate: fullReport.approximate.filter(isPending),
    missingTopics: fullReport.missingTopics.filter(isPending)
  };
  if (report.exact.length) blockers.push(`${report.exact.length} exact database duplicate(s)`);
  if (report.approximate.length) blockers.push(`${report.approximate.length} approximate database duplicate(s) at or above ${APPROXIMATE_THRESHOLD}`);
  if (report.missingTopics.length) blockers.push(`${report.missingTopics.length} missing or unusable topic mapping(s)`);
  return { report, blockers, safe: blockers.length === 0 };
}

function approvedBridgePlan(prepared) {
  const unique = new Map();
  for (const question of prepared) {
    if (question.mapping?.source !== 'approved_topic_mapping_file') continue;
    const key = `${question.mapping.examTopicId}:${question.mapping.specialPracticeTopicId}`;
    unique.set(key, { examTopicId: question.mapping.examTopicId, specialPracticeTopicId: question.mapping.specialPracticeTopicId, mappedTopicCode: question.mappedTopicCode, subject: question.subject, approvalScope: question.approvedTopicMapping.scope, proposalSha256: question.approvedTopicMapping.proposalSha256 });
  }
  return [...unique.values()];
}

async function ensureApprovedTopicBridges(tx, prepared) {
  const plan = approvedBridgePlan(prepared);
  for (const bridge of plan) {
    await tx.$executeRawUnsafe("INSERT INTO csca_topic_mappings (source_type, source_id, topic_id, confidence) VALUES ('special_practice_topic',$1,$2,1) ON CONFLICT (source_type, source_id, topic_id) DO NOTHING", bridge.specialPracticeTopicId, bridge.examTopicId);
    const confirmed = await tx.$queryRawUnsafe("SELECT id FROM csca_topic_mappings WHERE source_type = 'special_practice_topic' AND source_id = $1 AND topic_id = $2", bridge.specialPracticeTopicId, bridge.examTopicId);
    if (confirmed.length !== 1) throw new Error(`approved topic bridge could not be uniquely confirmed: ${bridge.mappedTopicCode}/${bridge.specialPracticeTopicId}`);
  }
  return plan;
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  for (const file of [path.resolve('.env'), path.resolve('backend/.env')]) {
    if (!fs.existsSync(file)) continue;
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((item) => /^DATABASE_URL\s*=/.test(item));
    if (line) { process.env.DATABASE_URL = line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2'); return; }
  }
}
async function queryInventory(tx) {
  const [cscaExamTopics, specialPracticeTopics, topicMappings, cscaQuestions, specialPracticeQuestions] = await Promise.all([
    tx.$queryRawUnsafe('SELECT id, subject, module, code, title, syllabus_version AS "syllabusVersion", status FROM csca_exam_topics'),
    tx.$queryRawUnsafe('SELECT id, subject, module, slug, title, status FROM special_practice_topics'),
    tx.$queryRawUnsafe("SELECT source_type AS \"sourceType\", source_id AS \"sourceId\", topic_id AS \"topicId\" FROM csca_topic_mappings WHERE source_type = 'special_practice_topic'"),
    tx.$queryRawUnsafe('SELECT id, prompt, options, source_question_id AS "sourceQuestionId", review_metadata AS "reviewMetadata" FROM csca_questions'),
    tx.$queryRawUnsafe('SELECT id, prompt, options FROM special_practice_questions')
  ]);
  return { cscaExamTopics, specialPracticeTopics, topicMappings, cscaQuestions, specialPracticeQuestions };
}
async function readInventory(prisma) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return queryInventory(tx);
  });
}

async function applyPack(prisma, validation, duplicateReport, confirmation) {
  if (!prisma) throw new Error('--apply cannot be used with --db-fixture');
  if (confirmation !== APPLY_CONFIRMATION) throw new Error(`--apply requires --confirm ${APPLY_CONFIRMATION}`);
  if (validation.errors.length || duplicateReport.exact.length || duplicateReport.approximate.length || duplicateReport.missingTopics.length) throw new Error('apply blocked by validation, database duplicates, or missing topic mappings');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))::text AS "lockResult"',
      `supervised-pack:${validation.packId}`
    );
    await tx.$executeRawUnsafe('LOCK TABLE csca_questions, special_practice_questions IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE csca_exam_topics, special_practice_topics, csca_topic_mappings IN SHARE MODE');
    for (const evidence of Object.values(validation.approvalFileEvidence ?? {}).filter(Boolean)) {
      if (sha256(fs.readFileSync(evidence.path)) !== evidence.sha256) throw new Error('topic mapping approval evidence changed after dry-run');
    }
    const lockedInventory = await queryInventory(tx);
    const lockedDecision = lockedRevalidation(validation.prepared, lockedInventory);
    if (!lockedDecision.safe) throw new Error(`apply blocked after locked revalidation: ${lockedDecision.blockers.join('; ')}`);
    const approvedTopicBridges = await ensureApprovedTopicBridges(tx, validation.prepared);
    const inserted = []; const skipped = [];
    for (const question of validation.prepared) {
      const existing = await tx.$queryRawUnsafe(`SELECT id, source_question_id AS "sourceQuestionId" FROM csca_questions WHERE review_metadata->'${REVIEW_NAMESPACE}'->>'idempotencyKey' = $1 LIMIT 2`, question.idempotencyKey);
      if (existing.length > 1) throw new Error(`${question.candidateId}: non-unique idempotency evidence`);
      if (existing.length === 1) { skipped.push({ candidateId: question.candidateId, cscaQuestionId: existing[0].id, specialPracticeQuestionId: existing[0].sourceQuestionId ?? null }); continue; }
      const lockedMapping = question.mapping.source === 'approved_topic_mapping_file'
        ? await tx.$queryRawUnsafe("SELECT spt.id FROM csca_exam_topics cet CROSS JOIN special_practice_topics spt WHERE cet.id = $1 AND cet.code = $2 AND cet.subject = $3 AND cet.status = 'published' AND spt.id = $4 AND spt.subject = $3 AND spt.status = 'published' FOR UPDATE OF cet, spt", question.mapping.examTopicId, question.mappedTopicCode, question.subject, question.mapping.specialPracticeTopicId)
        : await tx.$queryRawUnsafe("SELECT spt.id FROM csca_exam_topics cet JOIN csca_topic_mappings mapping ON mapping.topic_id = cet.id AND mapping.source_type = 'special_practice_topic' JOIN special_practice_topics spt ON spt.id = mapping.source_id WHERE cet.id = $1 AND cet.code = $2 AND cet.subject = $3 AND cet.status = 'published' AND spt.id = $4 AND spt.subject = $3 AND spt.status = 'published' FOR UPDATE OF cet, mapping, spt", question.mapping.examTopicId, question.mappedTopicCode, question.subject, question.mapping.specialPracticeTopicId);
      if (lockedMapping.length !== 1) throw new Error(`${question.candidateId}: topic mapping changed after locked revalidation`);
      const orderRows = await tx.$queryRawUnsafe('SELECT COALESCE(MAX(order_number), 0) + 1 AS "orderNumber" FROM special_practice_questions WHERE topic_id = $1', question.mapping.specialPracticeTopicId);
      const topicMappingApproval = question.approvedTopicMapping ? { status: question.approvedTopicMapping.approvalStatus, scope: question.approvedTopicMapping.scope, approvedAt: question.approvedTopicMapping.approvedAt, proposalSha256: question.approvedTopicMapping.proposalSha256, mappedTopicId: question.approvedTopicMapping.mappedTopicId, specialPracticeTopicId: question.approvedTopicMapping.specialPracticeTopicId } : null;
      const trace = { namespace: REVIEW_NAMESPACE, acceptanceType: 'dual-session supervised acceptance', idempotencyKey: question.idempotencyKey, candidateId: question.candidateId, originalTopicCode: question.originalTopicCode, mappedTopicCode: question.mappedTopicCode, specialPracticeTopicId: question.mapping.specialPracticeTopicId, topicMappingSource: question.mapping.source, topicMappingApproval, contentSha256: question.fingerprints.contentHash, promptSha256: question.fingerprints.promptHash, optionsSha256: question.fingerprints.optionsHash, packId: validation.packId, manifestQuestionsSha256: validation.computedQuestionsDigest, reviewerTaskId: question.review?.reviewerTaskId ?? null, auditStatus: question.audit?.status ?? null };
      const generationMetadata = { origin: 'codex_dual_session_pilot', import: { type: 'manual_supervised_pack', candidateId: question.candidateId, packId: validation.packId, originalTopicCode: question.originalTopicCode, mappedTopicCode: question.mappedTopicCode, specialPracticeTopicId: question.mapping.specialPracticeTopicId, topicMappingSource: question.mapping.source, topicMappingApproval }, localizations: question.localizations ?? null };
      const reviewMetadata = { [REVIEW_NAMESPACE]: trace };
      const cscaRows = await tx.$queryRawUnsafe(`INSERT INTO csca_questions (subject, topic_id, source_type, designed_difficulty, question_type, prompt, options, correct_answer, explanation, knowledge_tags, syllabus_version, generation_metadata, review_metadata, status, updated_at) VALUES ($1,$2,'manual_supervised_pack',$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,'approved',CURRENT_TIMESTAMP) RETURNING id`, question.subject, question.mapping.examTopicId, question.designedDifficulty, question.questionType, question.prompt, JSON.stringify(question.options), question.correctAnswer, question.explanation, JSON.stringify(question.knowledgeTags ?? []), question.syllabusVersion, JSON.stringify(generationMetadata), JSON.stringify(reviewMetadata));
      const spRows = await tx.$queryRawUnsafe(`INSERT INTO special_practice_questions (topic_id, order_number, difficulty, question_type, prompt, options, correct_answer, explanation, knowledge_tags, localizations, status, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,'published',CURRENT_TIMESTAMP) RETURNING id`, question.mapping.specialPracticeTopicId, Number(orderRows[0].orderNumber), question.designedDifficulty, question.questionType === 'single_choice' ? 'single-choice' : question.questionType, question.prompt, JSON.stringify(question.options), question.correctAnswer, question.explanation, JSON.stringify(question.knowledgeTags ?? []), JSON.stringify(question.localizations ?? null));
      await tx.$executeRawUnsafe('UPDATE csca_questions SET source_question_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', spRows[0].id, cscaRows[0].id);
      await tx.$executeRawUnsafe("INSERT INTO csca_topic_mappings (source_type, source_id, topic_id, confidence) VALUES ('special_practice_question',$1,$2,1) ON CONFLICT (source_type, source_id, topic_id) DO NOTHING", spRows[0].id, question.mapping.examTopicId);
      inserted.push({ candidateId: question.candidateId, cscaQuestionId: cscaRows[0].id, specialPracticeQuestionId: spRows[0].id });
    }
    const topicIds = [...new Set(validation.prepared.map((item) => item.mapping.specialPracticeTopicId))];
    await tx.$executeRawUnsafe("UPDATE special_practice_topics t SET question_count = q.count, updated_at = CURRENT_TIMESTAMP FROM (SELECT topic_id, COUNT(*)::int AS count FROM special_practice_questions WHERE status='published' AND topic_id = ANY($1::int[]) GROUP BY topic_id) q WHERE t.id=q.topic_id", topicIds);
    return { approvedTopicBridges, inserted, skipped };
  }, { timeout: 30000 });
}

function help() { return `Usage: node question-production/tools/import-accepted-pack.cjs --pack <directory|pack.json> [--db-fixture file] [--json]\n\nDefault mode validates and opens a read-only database transaction. Applying is disabled unless both --apply and --confirm ${APPLY_CONFIRMATION} are supplied.`; }
async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { console.log(help()); return 0; }
  if (!args.pack) throw new Error('--pack is required');
  if (args.confirm && !args.apply) throw new Error('--confirm is invalid without --apply');
  if (args.apply && args.confirm !== APPLY_CONFIRMATION) throw new Error(`--apply requires --confirm ${APPLY_CONFIRMATION}`);
  if (args.apply && args.db_fixture) throw new Error('--apply cannot be used with --db-fixture');
  const validation = validatePack(loadPack(args.pack)); let prisma = null;
  try {
    let inventory;
    if (args.db_fixture) inventory = readJson(path.resolve(args.db_fixture));
    else { loadDatabaseUrl(); const { PrismaClient } = require(path.resolve('node_modules/@prisma/client')); prisma = new PrismaClient(); inventory = await readInventory(prisma); }
    const inventoryDecision = lockedRevalidation(validation.prepared, inventory);
    const duplicates = inventoryDecision.report;
    const blockers = [...validation.errors];
    blockers.push(...inventoryDecision.blockers);
    const applyResult = args.apply ? await applyPack(prisma, validation, duplicates, args.confirm) : null;
    const report = { mode: args.apply ? 'apply' : 'dry-run', safeToApply: blockers.length === 0, packId: validation.packId, counts: { total: validation.prepared.length, ...Object.fromEntries(Object.keys(EXPECTED).map((subject) => [subject, validation.prepared.filter((q) => q.subject === subject).length])) }, validation: { errors: validation.errors, warnings: validation.warnings }, database: { access: args.db_fixture ? 'fixture' : 'read-only transaction', exactDuplicates: duplicates.exact, approximateDuplicates: duplicates.approximate, bridgeWillBeCreated: duplicates.bridgeWillBeCreated, idempotentExisting: duplicates.idempotentExisting, missingTopicMappings: duplicates.missingTopics }, idempotency: { format: 'candidateId:sha256(canonical normalized prompt+options)', namespace: REVIEW_NAMESPACE }, blockers, applyResult };
    console.log(args.json ? JSON.stringify(report, null, 2) : [`Mode: ${report.mode}`, `Questions: ${report.counts.total} (math ${report.counts.math}, physics ${report.counts.physics}, chemistry ${report.counts.chemistry})`, `Exact DB duplicates: ${duplicates.exact.length}; approximate: ${duplicates.approximate.length}`, `Approved topic bridges to create: ${duplicates.bridgeWillBeCreated.length}`, `Missing topic mappings: ${duplicates.missingTopics.length}`, `Safe to apply: ${report.safeToApply ? 'yes' : 'no'}`, ...blockers.map((item) => `BLOCK: ${item}`)].join('\n'));
    return blockers.length ? 2 : 0;
  } finally { if (prisma) await prisma.$disconnect(); }
}

if (require.main === module) run().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
module.exports = { APPLY_CONFIRMATION, REVIEW_NAMESPACE, approvedBridgePlan, compareWithInventory, ensureApprovedTopicBridges, fingerprints, loadDatabaseUrl, loadPack, lockedRevalidation, queryInventory, readInventory, run, stable, validatePack };
