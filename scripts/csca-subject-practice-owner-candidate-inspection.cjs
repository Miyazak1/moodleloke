#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { loadRootEnv } = require('../backend/scripts/load-root-env.cjs');
const { solveElementaryFunctionDirectProperty } = require('../backend/src/ai-questioning/subject-practice-math-solver');
const { subjectPracticeClassifyTaskFamily } = require('../backend/src/ai-questioning/subject-practice-task-family-policy');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvInts(value) {
  return cleanText(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function digestFor(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalValue(value))).digest('hex');
}

function optionRows(value) {
  return arrayFrom(value).map((option) => ({
    id: cleanText(option?.id),
    text: cleanText(option?.text)
  }));
}

function structuralChecksFor(question, expected) {
  const options = optionRows(question.options);
  const optionIds = options.map((option) => option.id).filter(Boolean);
  const optionTexts = options.map((option) => option.text).filter(Boolean);
  const correctAnswer = cleanText(question.correctAnswer);
  const choiceQuestion = /choice/i.test(cleanText(question.questionType));
  const checks = {
    exactSubject: cleanText(question.subject) === expected.subject,
    exactProductionRun: cleanText(question.generationMetadata?.productionRunId) === String(expected.runId),
    promptPresent: Boolean(cleanText(question.prompt)),
    explanationPresent: Boolean(cleanText(question.explanation)),
    knowledgeTagsPresent: arrayFrom(question.knowledgeTags).map(cleanText).filter(Boolean).length > 0,
    optionsPresentForChoice: !choiceQuestion || options.length >= 2,
    optionIdsCompleteAndUnique: !choiceQuestion || (optionIds.length === options.length && new Set(optionIds).size === optionIds.length),
    optionTextsCompleteAndUnique: !choiceQuestion || (optionTexts.length === options.length && new Set(optionTexts).size === optionTexts.length),
    correctAnswerResolvesToOption: !choiceQuestion || optionIds.includes(correctAnswer)
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
  };
}

function contentForQuestion(question) {
  return {
    id: question.id,
    subject: question.subject,
    productionRunId: cleanText(question.generationMetadata?.productionRunId) || null,
    productionCellId: cleanText(question.generationMetadata?.productionCellId) || null,
    topicId: question.topicId,
    blueprintId: question.blueprintId,
    designedDifficulty: question.designedDifficulty,
    questionType: question.questionType,
    prompt: question.prompt,
    options: optionRows(question.options),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    knowledgeTags: arrayFrom(question.knowledgeTags),
    status: question.status
  };
}

function deterministicAnswerVerificationFor(question) {
  const generationMetadata = recordFrom(question.generationMetadata) || {};
  const questionPlan = recordFrom(generationMetadata.questionPlan);
  const taskFamily = subjectPracticeClassifyTaskFamily({
    subject: question.subject,
    prompt: question.prompt,
    options: optionRows(question.options),
    explanation: ''
  });
  const evidence = question.subject === 'math' && taskFamily === 'elementary_function_direct_property'
    ? solveElementaryFunctionDirectProperty({
      subject: question.subject,
      prompt: question.prompt,
      options: optionRows(question.options),
      correctAnswer: question.correctAnswer
    }, { questionPlan })
    : null;
  return {
    taskFamily,
    evidence,
    releaseQualified: false,
    releaseQualificationReason: evidence
      ? 'solver_is_shadow_only_and_subset_benchmark_is_not_family_release_qualified'
      : 'no_registered_deterministic_solver_for_classified_family'
  };
}

function exactContentSetSha256For(items) {
  return digestFor(items.map((item) => ({
    id: item.id,
    contentSha256: item.contentSha256 || digestFor(item)
  })));
}

function dryRunGate(subject, runId, candidateIds) {
  const output = execFileSync(process.execPath, [
    path.resolve(__dirname, 'csca-subject-practice-owner-revalidation-apply.cjs'),
    `--subject=${subject}`,
    `--run=${runId}`,
    `--candidate-ids=${candidateIds.join(',')}`,
    '--json'
  ], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function selfTest() {
  const fixture = {
    subject: 'chemistry',
    questionType: 'single_choice',
    prompt: '题干',
    options: [{ id: 'A', text: '甲' }, { id: 'B', text: '乙' }],
    correctAnswer: 'B',
    explanation: '解析',
    knowledgeTags: ['标签'],
    generationMetadata: { productionRunId: 3 }
  };
  const passed = structuralChecksFor(fixture, { subject: 'chemistry', runId: 3 });
  if (passed.status !== 'passed') throw new Error('Expected valid fixture to pass.');
  const invalid = structuralChecksFor({ ...fixture, correctAnswer: 'C' }, { subject: 'chemistry', runId: 3 });
  if (invalid.status !== 'failed' || !invalid.failures.includes('correctAnswerResolvesToOption')) {
    throw new Error('Expected unresolved answer fixture to fail.');
  }
  const stable = digestFor(fixture) === digestFor({ ...fixture, generationMetadata: { productionRunId: 3 } });
  if (!stable) throw new Error('Expected canonical content digest to be stable.');
  return {
    mode: 'subject_practice_owner_candidate_inspection_self_test',
    status: 'passed',
    fixtures: 3,
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection'
  };
}

async function main() {
  const outputJson = hasFlag('json');
  if (hasFlag('self-test')) {
    console.log(JSON.stringify(selfTest(), null, 2));
    return;
  }
  const subject = cleanText(argValue('subject')).toLowerCase();
  const runId = Number.parseInt(argValue('run', argValue('production-run')), 10);
  const rawCandidateIds = csvInts(argValue('candidate-ids'));
  const candidateIds = [...new Set(rawCandidateIds)];
  if (!['math', 'physics', 'chemistry'].includes(subject)) throw new Error('--subject=math|physics|chemistry is required.');
  if (!Number.isInteger(runId) || runId <= 0) throw new Error('--run=<productionRunId> is required.');
  if (!candidateIds.length) throw new Error('--candidate-ids=<id,id,...> is required.');
  if (candidateIds.length !== rawCandidateIds.length) throw new Error('--candidate-ids must contain unique positive integer ids.');
  if (candidateIds.length > 10) throw new Error('At most 10 exact candidate ids may be inspected at once.');

  loadRootEnv();
  const prisma = new PrismaClient();
  try {
    const questions = await prisma.cscaQuestion.findMany({
      where: { id: { in: candidateIds }, subject },
      select: {
        id: true,
        subject: true,
        topicId: true,
        blueprintId: true,
        designedDifficulty: true,
        questionType: true,
        prompt: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        knowledgeTags: true,
        generationMetadata: true,
        status: true
      },
      orderBy: { id: 'asc' }
    });
    const byId = new Map(questions.map((question) => [question.id, question]));
    const missingCandidateIds = candidateIds.filter((id) => !byId.has(id));
    const gate = dryRunGate(subject, runId, candidateIds);
    const gateById = new Map(arrayFrom(gate?.items).map((item) => [Number(item.id), item]));
    const items = candidateIds.flatMap((id) => {
      const question = byId.get(id);
      if (!question) return [];
      const content = contentForQuestion(question);
      const structural = structuralChecksFor(question, { subject, runId });
      const gateItem = gateById.get(id) || {};
      const formalGate = {
        action: cleanText(gateItem.action) || 'missing',
        decision: cleanText(gateItem.gateDecision) || null,
        blockReasons: arrayFrom(gateItem.blockReasons).map(cleanText).filter(Boolean),
        publishable: cleanText(gateItem.action) === 'would_auto_approve_via_existing_gate'
      };
      const deterministicAnswerVerification = deterministicAnswerVerificationFor(question);
      return [{
        ...content,
        contentSha256: digestFor(content),
        structuralValidation: structural,
        formalGate,
        deterministicAnswerVerification,
        manualAcademicReviewRequired: true
      }];
    });
    const readyForManualAuthorizationReview = missingCandidateIds.length === 0
      && items.length === candidateIds.length
      && items.every((item) => item.structuralValidation.status === 'passed' && item.formalGate.publishable);
    const report = {
      mode: 'subject_practice_owner_candidate_inspection',
      status: readyForManualAuthorizationReview ? 'ready_for_manual_academic_authorization_review' : 'not_ready',
      subject,
      productionRunId: runId,
      requestedCandidateIds: candidateIds,
      foundCandidateIds: items.map((item) => item.id),
      missingCandidateIds,
      providerImpact: 'none_no_provider_call',
      dbImpact: 'read_only',
      publicationImpact: 'none',
      doesNotAuthorizeExecution: true,
      reviewBoundary: 'structural_and_formal_gate_checks_do_not_replace_manual_academic_correctness_review',
      deterministicVerificationBoundary: 'shadow_only_subset_solver_does_not_authorize_publication',
      exactContentSetSha256: exactContentSetSha256For(items),
      items
    };
    if (outputJson) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
      return;
    }
    console.log(`Status: ${report.status}`);
    console.log(`Subject/run: ${subject}/${runId}`);
    console.log(`Candidates: ${report.foundCandidateIds.join(',') || '(none)'}`);
    console.log(`Exact content set SHA-256: ${report.exactContentSetSha256}`);
    for (const item of report.items) {
      console.log(`\n#${item.id} ${item.designedDifficulty} ${item.questionType}`);
      console.log(item.prompt);
      for (const option of item.options) console.log(`${option.id}. ${option.text}`);
      console.log(`Answer: ${item.correctAnswer}`);
      console.log(`Explanation: ${item.explanation}`);
      console.log(`Structural: ${item.structuralValidation.status}; gate: ${item.formalGate.action}`);
      const solver = item.deterministicAnswerVerification?.evidence;
      console.log(`Deterministic answer verification: ${solver ? `${solver.status}; true=${solver.trueOptionIds.join(',') || '(none)'}` : 'not_available'}`);
      console.log(`Content SHA-256: ${item.contentSha256}`);
    }
    console.log('\nThis read-only report does not authorize database writes, Provider calls, or publication.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  contentForQuestion,
  digestFor,
  exactContentSetSha256For,
  deterministicAnswerVerificationFor,
  structuralChecksFor
};
