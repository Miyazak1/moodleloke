#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = Object.freeze({ math: 10, physics: 10, chemistry: 10 });

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot parse JSON ${file}: ${error.message}`); }
}
function fileEvidence(file, root) {
  const raw = fs.readFileSync(file);
  return { path: path.relative(root, file).replace(/\\/g, '/'), sha256: sha256(raw), bytes: raw.length };
}
function safeSegment(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+$/.test(value)) throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}
function parseArgs(argv) {
  const args = { checkOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--selection') args.selection = argv[++i];
    else if (argv[i] === '--audit') args.audit = argv[++i];
    else if (argv[i] === '--batches-root') args.batchesRoot = argv[++i];
    else if (argv[i] === '--output-dir') args.outputDir = argv[++i];
    else if (argv[i] === '--check-only') args.checkOnly = true;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}
function reviewTruth(review) {
  const entries = Object.entries(review?.optionTruthTable ?? {});
  const trueIds = entries.filter(([, value]) => value === true).map(([id]) => id);
  return { entries, trueIds };
}
function increment(target, key) { target[key] = (target[key] ?? 0) + 1; }

function validateAndBuild({ selection, selectionEvidence, audit, auditEvidence, sourced }) {
  const errors = [];
  const candidates = selection?.candidates;
  if (!Array.isArray(candidates)) throw new Error('selection.candidates must be an array');
  if (candidates.length !== 30) errors.push(`selection must contain exactly 30 candidates; found ${candidates.length}`);
  const ids = candidates.map((entry) => entry?.candidateId);
  if (new Set(ids).size !== ids.length) errors.push('selection candidateId values are not unique');
  const auditEntries = Array.isArray(audit?.questions) ? audit.questions : [];
  const auditById = new Map();
  for (const entry of auditEntries) {
    if (auditById.has(entry.candidateId)) errors.push(`${entry.candidateId}: duplicate audit entry`);
    auditById.set(entry.candidateId, entry);
  }
  if (audit?.selectionPlan?.selectionId && audit.selectionPlan.selectionId !== selection.selectionId) errors.push('audit selectionId does not match selection');
  if (audit?.selectionPlan?.sha256 && audit.selectionPlan.sha256 !== selectionEvidence.sha256) errors.push('audit selection-plan SHA-256 does not match current selection file');

  const counts = { math: 0, physics: 0, chemistry: 0 };
  const familyDistribution = { math: {}, physics: {}, chemistry: {} };
  const topicDistribution = { math: {}, physics: {}, chemistry: {} };
  const questions = []; const reviews = []; const sourceItems = [];
  for (const source of sourced) {
    const { selected, question, review, sealedEvidence, reviewEvidence } = source;
    const id = selected.candidateId;
    if (question?.candidateId !== id) errors.push(`${id}: sealed candidateId mismatch`);
    if (review?.candidateId !== id) errors.push(`${id}: review candidateId mismatch`);
    if (!Object.hasOwn(EXPECTED, question?.subject)) errors.push(`${id}: invalid subject ${question?.subject}`);
    else counts[question.subject] += 1;
    if (question?.generationMetadata?.languageScope !== 'zh_primary_only' || !/[\u3400-\u9fff]/u.test(`${question?.prompt ?? ''}${question?.explanation ?? ''}`)) errors.push(`${id}: sealed question is not demonstrably zh-primary`);
    if (!question?.generationMetadata || typeof question.generationMetadata !== 'object') errors.push(`${id}: generationMetadata is missing`);
    const deterministic = question?.generationMetadata?.deterministicVerification;
    const solver = deterministic?.solver; const oracle = deterministic?.oracle; const sealedTruth = deterministic?.optionTruthTable; const replay = deterministic?.explanationReplay;
    if (solver?.status !== 'verified' || solver?.uniqueAnswer !== true || solver?.selectedOptionId !== question?.correctAnswer) errors.push(`${id}: sealed deterministic solver evidence is not verified/unique/answer-consistent`);
    if (oracle?.status !== 'verified' || oracle?.agreesWithSolver !== true) errors.push(`${id}: sealed independent oracle evidence is not verified or does not agree`);
    const sealedTrueIds = Array.isArray(sealedTruth) ? sealedTruth.filter((entry) => entry?.verdict === true).map((entry) => entry.optionId) : [];
    if (!Array.isArray(sealedTruth) || sealedTruth.length !== 4 || sealedTrueIds.length !== 1 || sealedTrueIds[0] !== question?.correctAnswer) errors.push(`${id}: sealed deterministic option truth table is not uniquely answer-consistent`);
    if (replay?.status !== 'verified' || replay?.allRequiredTokensPresent !== true || replay?.conclusionMatchesAnswer !== true) errors.push(`${id}: sealed explanation replay evidence is incomplete`);
    const family = question?.questionPlan?.taskFamily;
    if (!family) errors.push(`${id}: questionPlan.taskFamily is missing`);
    else if (Object.hasOwn(familyDistribution, question.subject)) increment(familyDistribution[question.subject], family);
    if (!question?.topicCode) errors.push(`${id}: topicCode is missing`);
    else if (Object.hasOwn(topicDistribution, question.subject)) increment(topicDistribution[question.subject], question.topicCode);
    const verdict = String(review?.verdictAfterReveal ?? review?.finalVerdict ?? review?.verdictBeforeReveal ?? review?.status ?? '').toLowerCase();
    if (!['pass', 'passed', 'accepted'].includes(verdict)) errors.push(`${id}: review verdict is not pass`);
    if (review?.derivedAnswer !== question?.correctAnswer) errors.push(`${id}: reviewer answer does not match sealed answer`);
    if (review?.conditionsSufficient !== true) errors.push(`${id}: review conditionsSufficient must be true`);
    if (review?.syllabusAligned !== true) errors.push(`${id}: review syllabusAligned must be true`);
    if (review?.ambiguityFound !== false) errors.push(`${id}: review ambiguityFound must be false`);
    const truth = reviewTruth(review);
    const optionIds = Array.isArray(question?.options) ? question.options.map((option) => option?.id) : [];
    if (optionIds.length !== 4 || new Set(optionIds).size !== 4 || stable([...optionIds].sort()) !== stable(['A', 'B', 'C', 'D'])) errors.push(`${id}: sealed options must contain unique A-D ids`);
    if (truth.entries.length !== 4 || stable(truth.entries.map(([key]) => key).sort()) !== stable(['A', 'B', 'C', 'D']) || truth.trueIds.length !== 1 || truth.trueIds[0] !== question?.correctAnswer) errors.push(`${id}: review option truth table must have A-D and exactly the sealed answer true`);
    if (Array.isArray(review?.reasonCodes) && review.reasonCodes.length) errors.push(`${id}: review reasonCodes must be empty`);
    const auditEntry = auditById.get(id);
    if (!auditEntry) errors.push(`${id}: audit entry missing`);
    else if (String(auditEntry.status).toLowerCase() !== 'clear') errors.push(`${id}: audit status must be clear; found ${auditEntry.status ?? 'missing'}`);
    questions.push(question); reviews.push(review);
    sourceItems.push({ candidateId: id, subject: question?.subject ?? null, batch: selected.batch, taskFamily: family ?? null, topicCode: question?.topicCode ?? null, sealed: sealedEvidence, blindReview: { ...reviewEvidence, reviewerTaskId: review?.reviewerTaskId ?? null, verdict, derivedAnswer: review?.derivedAnswer ?? null }, audit: auditEntry ? { status: auditEntry.status, sourceFileSha256: auditEntry.sourceFileSha256 ?? null, fingerprints: auditEntry.fingerprints ?? null } : null });
  }
  for (const [subject, expected] of Object.entries(EXPECTED)) {
    if (counts[subject] !== expected) errors.push(`${subject}: expected ${expected} questions; found ${counts[subject]}`);
    const familyCount = Object.keys(familyDistribution[subject]).length;
    if (familyCount < 10) errors.push(`${subject}: expected at least 10 distinct questionPlan.taskFamily values; found ${familyCount}`);
  }
  if (errors.length) return { errors };
  const questionsSha256 = sha256(stable(questions));
  const manifest = {
    schemaVersion: 'codex-accepted-question-pack-manifest-v1',
    packId: selection.selectionId,
    selectionId: selection.selectionId,
    languageScope: 'zh_primary_only',
    candidateIds: ids,
    questionCount: questions.length,
    countsBySubject: counts,
    questionsSha256,
    distribution: { familiesBySubject: familyDistribution, topicsBySubject: topicDistribution },
    evidence: {
      selection: selectionEvidence,
      originalityAudit: { ...auditEvidence, schemaVersion: audit.schemaVersion, reportSha256: audit.reportSha256 ?? null, reportedFormalQualificationEligible: audit.formalQualificationEligible ?? null, auditAloneDoesNotAuthorizePublication: true, selectedCandidateRule: 'every selected candidate status must equal clear' },
      items: sourceItems
    },
    governance: { auditAloneDoesNotAuthorizePublication: true, qualificationBasis: ['blind_review_pass', 'generator_reviewer_answer_agreement', 'deterministic_solver_oracle_truth_table_and_explanation_replay', 'per_candidate_originality_clear', 'supervised_acceptance'] },
    assembly: { tool: 'question-production/tools/assemble-accepted-pack.cjs', canonicalization: 'recursive lexicographic object keys; array order preserved', sourceMutation: 'none' }
  };
  return { errors, questions, reviews, manifest };
}

function resolveSources({ selectionFile, auditFile, batchesRoot, repoRoot }) {
  const selection = readJson(selectionFile); const audit = readJson(auditFile);
  const sourced = (selection.candidates ?? []).map((selected) => {
    const batch = safeSegment(selected.batch, 'batch'); const candidateId = safeSegment(selected.candidateId, 'candidateId');
    const batchRoot = path.resolve(batchesRoot, batch);
    if (path.relative(path.resolve(batchesRoot), batchRoot).startsWith('..')) throw new Error(`${candidateId}: batch escapes batches root`);
    const sealedFile = path.join(batchRoot, 'sealed', `${candidateId}.json`);
    const reviewCandidates = [path.join(batchRoot, 'reviews', `${candidateId}.review.json`), path.join(batchRoot, 'reviews', candidateId, 'review.json')].filter(fs.existsSync);
    if (!fs.existsSync(sealedFile)) throw new Error(`${candidateId}: sealed file missing at ${sealedFile}`);
    if (!reviewCandidates.length) throw new Error(`${candidateId}: blind review file missing`);
    const review = readJson(reviewCandidates[0]);
    if (reviewCandidates.length > 1 && stable(review) !== stable(readJson(reviewCandidates[1]))) throw new Error(`${candidateId}: two review layouts disagree`);
    return { selected, question: readJson(sealedFile), review, sealedEvidence: fileEvidence(sealedFile, repoRoot), reviewEvidence: fileEvidence(reviewCandidates[0], repoRoot) };
  });
  return { selection, audit, sourced, selectionEvidence: fileEvidence(selectionFile, repoRoot), auditEvidence: fileEvidence(auditFile, repoRoot) };
}

function writeOutputs(outputDir, result) {
  fs.mkdirSync(outputDir, { recursive: true });
  const nonce = `${process.pid}-${Date.now()}`;
  const outputs = [['questions.json', result.questions], ['reviews.json', result.reviews], ['manifest.json', result.manifest]].map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]);
  const existing = outputs.filter(([name]) => fs.existsSync(path.join(outputDir, name)));
  if (existing.length) {
    const allIdentical = existing.length === outputs.length && outputs.every(([name, text]) => fs.readFileSync(path.join(outputDir, name), 'utf8') === text);
    if (allIdentical) return 'unchanged';
    throw new Error('one or more output files already exist with different or incomplete content; refusing to overwrite');
  }
  const staged = [];
  try {
    for (const [name, text] of outputs) {
      const temp = path.join(outputDir, `.${name}.${nonce}.tmp`);
      fs.writeFileSync(temp, text, { flag: 'wx' }); staged.push([temp, path.join(outputDir, name)]);
    }
    for (const [temp, target] of staged) fs.renameSync(temp, target);
  } finally {
    for (const [temp] of staged) if (fs.existsSync(temp)) fs.rmSync(temp);
  }
  return 'written';
}

function help() { return 'Usage: node question-production/tools/assemble-accepted-pack.cjs [--selection file] [--audit file] [--batches-root dir] [--output-dir dir] [--check-only]'; }
function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv); if (args.help) { console.log(help()); return 0; }
  const questionRoot = path.resolve(__dirname, '..'); const repoRoot = path.resolve(questionRoot, '..');
  const selectionFile = path.resolve(args.selection ?? path.join(questionRoot, 'accepted', 'pilot-30-v4', 'selection-plan.json'));
  const outputDir = path.resolve(args.outputDir ?? path.dirname(selectionFile));
  const auditFile = path.resolve(args.audit ?? path.join(outputDir, 'audit', 'originality-audit.json'));
  const batchesRoot = path.resolve(args.batchesRoot ?? path.join(questionRoot, 'batches'));
  const inputs = resolveSources({ selectionFile, auditFile, batchesRoot, repoRoot });
  const result = validateAndBuild(inputs);
  if (result.errors.length) {
    console.error(['ASSEMBLY BLOCKED; no outputs written.', ...result.errors.map((error) => `- ${error}`)].join('\n'));
    return 2;
  }
  const writeStatus = args.checkOnly ? 'checked' : writeOutputs(outputDir, result);
  console.log(`${args.checkOnly ? 'CHECK PASSED' : writeStatus === 'unchanged' ? 'ALREADY ASSEMBLED' : 'ASSEMBLED'}: ${result.questions.length} questions; SHA-256 ${result.manifest.questionsSha256}`);
  return 0;
}

if (require.main === module) { try { process.exitCode = run(); } catch (error) { console.error(`ASSEMBLY ERROR; no outputs written.\n- ${error.message}`); process.exitCode = 1; } }
module.exports = { run, stable, validateAndBuild };
