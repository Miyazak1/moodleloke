'use strict';
// Requires a dedicated, migrated loopback acceptance database. Never loads .env.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const database = process.env.MATH_ENGINE_ACCEPTANCE_DATABASE_URL;
if (!database) throw Error('Set MATH_ENGINE_ACCEPTANCE_DATABASE_URL to the isolated migrated acceptance database.');
const url = new URL(database);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/moodlelike_math_engine_acceptance', 'Refusing a non-acceptance database');
for (const key of Object.keys(process.env)) {
  if (/KEY|TOKEN|SECRET|SMTP|DATABASE|REDIS|PROVIDER|^CSCA_|^AGENT_|^MOODLELIKE_|^CSC_ENV$/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'test', MOODLELIKE_ENV: 'test', DATABASE_URL: database, AUTH_SECRET: 'math-engine-local-student-acceptance-secret-only',
  AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  MOODLELIKE_MATH_ENGINE_ENABLED: 'true', CSCA_AI_QUESTION_GENERATION_ENABLED: 'false',
  QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'verified-math-1.43',
  CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'false', CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'false'
});
if (process.argv.includes('--figures')) process.env.MOODLELIKE_READING_PILOTS_ENABLED = 'true';
const realFetch = globalThis.fetch;
globalThis.fetch = (address, options) => {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname), 'External Provider forbidden');
  return realFetch(address, options);
};
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/backend/src/app.module.js');
const { PrismaService } = require('../dist/backend/src/prisma/prisma.service.js');
const { AdaptiveQuestionProviderService } = require('../dist/backend/src/csca-special-practice/adaptive-question-provider.service.js');
const { VerifiedQuestionSupplyService } = require('../dist/backend/src/question-engine-plugin/verified-question-supply.service.js');
const { QuestionEnginePluginRegistryService } = require('../dist/backend/src/question-engine-plugin/question-engine-plugin-registry.service.js');
const { CscaAdaptiveService } = require('../dist/backend/src/csca-special-practice/csca-adaptive.service.js');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({ origin: true, credentials: true });
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  assert.equal(app.get(VerifiedQuestionSupplyService).isEnabled(), true);
  assert.equal(app.get(CscaAdaptiveService).questionSupply, app.get(VerifiedQuestionSupplyService));
  const registry = app.get(QuestionEnginePluginRegistryService);
  assert.deepEqual(registry.getStatus().plugins.map(plugin => plugin.descriptor.id), ['verified-math-1.43']);
  const base = await app.getUrl();
  let token;
  async function request(route, method = 'GET', input) {
    const response = await fetch(base + route, { method, signal: AbortSignal.timeout(150000), headers: {
      'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {})
    }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const value = await response.json();
    assert.ok(response.ok, route + ' ' + response.status + ' ' + JSON.stringify(value));
    return value;
  }
  try {
    const topicCode = process.argv.includes('--legacy-topic') ? 'math-solid-geometry' : 'M-GEO-002';
    const topic = await prisma.cscaExamTopic.upsert({ where: { code: topicCode },
      create: { code: topicCode, subject: 'math', title: '空间几何', syllabusVersion: '2025', status: 'published' }, update: {} });
    const auth = await request('/api/v1/auth/register', 'POST', { email: 'math-engine-' + randomUUID() + '@example.test', password: 'Local-acceptance-password-123!' });
    token = auth.tokens.accessToken;
    const userId = Number(auth.user.id);
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    const previouslyAvailable = await prisma.cscaQuestion.findMany({ where: { topicId: topic.id }, select: { id: true } });
    if (previouslyAvailable.length) await prisma.cscaQuestionExposure.createMany({ data: previouslyAvailable.map(question => ({ userId, questionId: question.id, source: 'adaptive_round:csca_question' })), skipDuplicates: true });
    const batchSize = process.argv.includes('--legacy-topic') ? 5 : 1;
    const input = { clientRequestId: randomUUID(), subject: 'math', practiceMode: 'single_topic', focusTopicId: topic.id,
      difficulty: 'hard', questionCount: batchSize, questionLanguage: 'zh' };
    const launch = await request('/api/v1/agent/free-practice/start', 'POST', input);
    const repeated = await request('/api/v1/agent/free-practice/start', 'POST', input);
    assert.equal(repeated.roundId, launch.roundId, 'start idempotency');
    const route = '/api/v1/csca-special-practice/adaptive/rounds/' + launch.roundId;
    const detail = await request(route);
    assert.equal(detail.questions.length, batchSize);
    const question = detail.questions[0];
    for (const language of ['zh', 'en']) {
      const reread = await request(route + '?language=' + language);
      assert.equal(reread.questions[0].id, question.id);
      for (const key of ['correctAnswer', 'explanation', 'questionArtifact', 'generationSource', 'answerBinding', 'sourceCandidate', 'sourceVerification']) {
        assert.equal(JSON.stringify(reread.questions).includes('"' + key + '"'), false, 'answer leak: ' + key);
      }
    }
    const stored = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: question.id } });
    assert.equal(stored.sourceType, 'verified_math_engine'); assert.equal(stored.designedDifficulty, '较难');
    assert.equal(stored.generationMetadata.engineVersion, '1.43.0');
    assert.equal(stored.reviewMetadata.mathEngine.checks.oracle, true);
    assert.equal(stored.reviewMetadata.mathEngine.providerCalls, 0);
    assert.equal(stored.reviewMetadata.publication.state, 'published');
    assert.equal(stored.generationMetadata.pluginId, 'verified-math-1.43');
    const generationTask = await prisma.verifiedQuestionGenerationTask.findUniqueOrThrow({ where: { id: stored.generationMetadata.generationTaskId } });
    assert.equal(generationTask.state, 'published');
    assert.equal(generationTask.input.topicCode, topicCode);
    assert.equal(stored.generationMetadata.hostTopicCode, topicCode);
    assert.equal(stored.generationMetadata.cellId, 'M-GEO-002:hard');
    const publicTask = await request('/api/v1/agent/question-generation-tasks/' + generationTask.id);
    assert.equal(publicTask.publishedCount, 1);
    assert.equal(JSON.stringify(publicTask).includes('correctAnswer'), false);
    if (process.argv.includes('--figures')) {
      assert.equal(detail.questions[0].figure?.phase, 'question', 'native 1.43 figure expected');
    }
    const { isReadyMathEngineQuestion } = require('../dist/backend/src/csca-special-practice/math-engine-question.policy.js');
    assert.equal(isReadyMathEngineQuestion(stored), true);
    const changedLocale = structuredClone(stored);
    changedLocale.generationMetadata.localizations.en.prompt += ' changed';
    assert.equal(isReadyMathEngineQuestion(changedLocale), false, 'localized content is part of host admission');
    const duplicates = await Promise.allSettled([1, 2].map(() => prisma.cscaQuestion.create({ data: { ...stored, id: undefined } })));
    assert.ok(duplicates.every(result => result.status === 'rejected' && result.reason.code === 'P2002'), 'parallel duplicate writes must hit the identity constraint');
    const checked = await request(route + '/check', 'POST', { questionId: question.id, selected: stored.correctAnswer });
    assert.equal(checked.isCorrect, true); assert.ok(checked.explanation);
    await request(route, 'PATCH', { answers: { [question.id]: stored.correctAnswer }, timeSpent: { [question.id]: 30 } });
    const report = await request(route + '/submit', 'POST', {});
    assert.equal(report.items[0].isCorrect, true);
    await request(route + '/submit', 'POST', {});
    const evidenceCount = await prisma.learningEvidenceEvent.count({ where: { userId, questionId: 'csca_question:' + question.id, sourceId: String(launch.roundId) } });
    assert.equal(evidenceCount, 1, 'learning evidence must be written once');
    // Simulate a historical copy under the other host alias. Existing copied
    // records must not evade semantic exposure checks just because IDs differ.
    const aliasCode = topicCode === 'M-GEO-002' ? 'math-solid-geometry' : 'M-GEO-002';
    const alias = await prisma.cscaExamTopic.upsert({ where: { code: aliasCode }, create: { code: aliasCode, title: '立体几何', subject: 'math', status: 'published', syllabusVersion: topic.syllabusVersion }, update: {} });
    let aliasCopy = await prisma.cscaQuestion.findFirst({ where: { topicId: alias.id,
      generationMetadata: { path: ['mathIdentityHash'], equals: stored.generationMetadata.mathIdentityHash } } });
    if (!aliasCopy) aliasCopy = await prisma.cscaQuestion.create({ data: { ...stored, id: undefined, topicId: alias.id,
      generationMetadata: { ...stored.generationMetadata, hostTopicCode: aliasCode } } });
    const aliasCandidates = await app.get(AdaptiveQuestionProviderService).pickQuestions(userId, [{ topicId: alias.id, code: aliasCode, title: alias.title, module: null, targetDifficulty: '较难', reason: 'alias_exposure_regression' }], 10000, 'hard', { unseenOnly: true });
    assert.ok(aliasCandidates.every(item => item.questionId !== aliasCopy.id), 'historical alias copy must remain seen');
    console.log('CROSS_ALIAS_EXPOSURE_OK');
    await request('/api/v1/agent/practice-rounds/' + launch.roundId + '/settle', 'POST');
    const continuationInput = { ...input, clientRequestId: randomUUID() };
    const continued = await request('/api/v1/agent/free-practice/' + launch.artifactId + '/continue', 'POST', continuationInput);
    const continuedAgain = await request('/api/v1/agent/free-practice/' + launch.artifactId + '/continue', 'POST', continuationInput);
    assert.equal(continuedAgain.roundId, continued.roundId);
    const continuedDetail = await request('/api/v1/csca-special-practice/adaptive/rounds/' + continued.roundId);
    assert.equal(continuedDetail.questions.length, batchSize);
    const previousIds = new Set(detail.questions.map(item => item.id));
    assert.ok(continuedDetail.questions.every(item => !previousIds.has(item.id)), 'all continuation questions must be unseen');
    assert.notEqual(continuedDetail.questions[0].id, question.id, 'continuation must provide unseen inventory');
    const continuedStored = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: continuedDetail.questions[0].id } });
    assert.equal(continuedStored.topicId, topic.id);
    assert.equal(continuedStored.generationMetadata.hostTopicCode, topicCode);
    assert.equal(continuedStored.generationMetadata.cellId, 'M-GEO-002:hard');
    console.log('VERIFIED_CONTINUATION_OK', topicCode);
    if (process.argv.includes('--alias-only')) {
      console.log('ALIAS_ONLY_ACCEPTANCE_OK: historical alias exposure, verified generation and unseen continuation');
      return;
    }
    const independent = await app.get(AdaptiveQuestionProviderService).pickIndependentVerificationQuestions(userId, topic.id, 3);
    assert.ok(independent.every(item => item.questionId !== question.id), 'practice qualification must not become independent measurement');
    const supply = app.get(VerifiedQuestionSupplyService);
    const taskCount = await prisma.verifiedQuestionGenerationTask.count();
    for (const subjectCode of ['physics', 'chemistry']) {
      const result = await supply.dispatch({ ...generationTask.input, requestKey: randomUUID(), subjectCode });
      assert.equal(result.status, 'unsupported'); assert.equal(result.generationInvoked, false);
    }
    assert.equal((await supply.dispatch({ schemaVersion: '1' })).status, 'unsupported');
    assert.equal(await prisma.verifiedQuestionGenerationTask.count(), taskCount);
    const repeatedTasks = await Promise.all([1, 2].map(() => supply.dispatch(generationTask.input)));
    assert.ok(repeatedTasks.every(task => task.externalRequestId === generationTask.id));
    assert.equal(await prisma.verifiedQuestionGenerationTask.count(), taskCount);
    await assert.rejects(supply.status(userId + 1000000, generationTask.id), error => error.getStatus() === 404);
    const realGenerate = registry.generateVerifiedMath.bind(registry);
    const beforeFailedGeneration = await prisma.cscaQuestion.count();
    const failureInput = { ...generationTask.input, requestKey: 'negative-' + randomUUID() };
    registry.generateVerifiedMath = async () => { throw Error('ORACLE_REJECTED'); };
    let failedTask;
    try {
      failedTask = await supply.dispatch(failureInput);
      await assert.rejects(supply.run(failedTask.externalRequestId), error => error.getStatus() === 503);
    } finally { registry.generateVerifiedMath = realGenerate; }
    const failed = await prisma.verifiedQuestionGenerationTask.findUniqueOrThrow({ where: { id: failedTask.externalRequestId } });
    assert.equal(failed.state, 'failed'); assert.deepEqual(failed.questionIds, []);
    assert.equal(await prisma.cscaQuestion.count(), beforeFailedGeneration, 'rejected output must not reach inventory');
    // A restarted worker may reclaim an expired task; the request identity stays stable.
    await prisma.verifiedQuestionGenerationTask.update({ where: { id: failed.id }, data: { state: 'running', leaseOwner: 'dead-worker', leaseUntil: new Date(0) } });
    const recovered = await supply.dispatch(failureInput);
    assert.equal(recovered.externalRequestId, failed.id);
    assert.equal((await supply.run(failed.id)).length, 1);
    assert.equal((await supply.status(userId, failed.id)).state, 'published');
    console.log('SUPPLY_TASK_BOUNDARIES_OK: demand deduplication, unsupported subjects, ownership, failure without publication, expired lease recovery.');
    const preserved = [];
    for (const subject of ['math', 'physics', 'chemistry']) {
      const code = 'BANK-PRESERVATION-' + subject;
      const bankTopic = await prisma.cscaExamTopic.upsert({ where: { code }, create: { code, title: subject + '现有题库', subject, status: 'published', syllabusVersion: '2025' }, update: {} });
      let bank = await prisma.cscaQuestion.findFirst({ where: { topicId: bankTopic.id, sourceType: 'external_oer' } });
      if (!bank) bank = await prisma.cscaQuestion.create({ data: { subject, topicId: bankTopic.id, sourceType: 'external_oer', status: 'approved', syllabusVersion: '2025',
        designedDifficulty: '基础', questionType: 'single_choice', prompt: subject + '现成题：选择正确选项', options: ['A','B','C','D'].map(id => ({ id, text: id })), correctAnswer: 'A', explanation: '已有题库解析', knowledgeTags: [] } });
      const before = JSON.stringify([bank.prompt, bank.options, bank.correctAnswer, bank.explanation, bank.status]);
      const picked = await app.get(AdaptiveQuestionProviderService).pickQuestions(userId, [{ topicId: bankTopic.id, code, title: bankTopic.title, module: null, targetDifficulty: '基础', reason: 'preserve_existing_bank' }], 1, 'basic');
      assert.equal(picked[0].questionId, bank.id);
      const adaptive = app.get(CscaAdaptiveService);
      const session = await prisma.cscaAdaptiveSession.create({ data: { userId, subject, mode: 'practice', questionLanguage: 'zh' } });
      const bankRound = await adaptive.createRound(userId, String(session.id), { questionCount: 1, focusTopicId: bankTopic.id, topicMode: 'single_topic', difficulty: 'basic' });
      assert.equal(bankRound.questions[0].id, bank.id);
      assert.equal((await adaptive.checkAnswer(userId, String(bankRound.round.id), { questionId: bank.id, selected: 'A' })).isCorrect, true);
      await adaptive.patchRound(userId, String(bankRound.round.id), { answers: { [bank.id]: 'A' }, timeSpent: { [bank.id]: 5 } });
      assert.equal((await adaptive.submitRound(userId, String(bankRound.round.id))).items[0].isCorrect, true);
      const after = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: bank.id } });
      assert.equal(JSON.stringify([after.prompt, after.options, after.correctAnswer, after.explanation, after.status]), before);
      preserved.push(subject);
    }
    console.log('THREE_SUBJECT_EXISTING_BANKS_OK: ' + preserved.join(', ') + ' read, answer, check, submit, unchanged content.');
    if (process.argv.includes('--figures')) await require('./question-figures-live-cases.cjs').run({ app, prisma, userId, token, request, base, nativeQuestion: stored });
    if (process.argv.includes('--review-ui')) await require('./question-layout-review.cjs').run({ prisma, base, request, nativeQuestion: stored });
    if (process.argv.includes('--browser')) {
      const frontend = path.resolve(__dirname, '../../frontend');
      const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [frontend] })).href);
      const { chromium } = require('../../frontend/node_modules/@playwright/test');
      const previousCwd = process.cwd();
      process.chdir(frontend);
      const vite = await createServer({ root: frontend, configFile: path.join(frontend, 'vite.config.mjs'),
        define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(base), 'import.meta.env.VITE_AGENT_WEB_ENABLED': JSON.stringify('true') },
        server: { host: '127.0.0.1', port: 5199, strictPort: true } });
      await vite.listen();
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(value => {
          localStorage.setItem('moodlelike.accessToken', value);
          localStorage.setItem('moodlelike.agent.learningMode', 'free');
          localStorage.setItem('moodlelike.locale', 'zh-CN');
          localStorage.setItem('cscalite.locale', 'zh-CN');
        }, token);
        await page.goto('http://127.0.0.1:5199/agent?mode=free&subject=math');
        const card = page.locator('.agent-free-practice-card');
        await card.getByRole('radio', { name: '按知识点练习', exact: true }).click();
        await card.locator('.agent-free-practice-topic-picker select').first().selectOption(String(topic.id));
        await card.getByLabel('题目难度', { exact: true }).selectOption('hard');
        await card.getByRole('radio', { name: '3 题', exact: true }).click();
        const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/agent/free-practice/start') && response.request().method() === 'POST', { timeout: 150000 });
        await card.getByRole('button', { name: '开始练习', exact: true }).click();
        const response = await responsePromise;
        assert.equal(response.status(), 201, await response.text());
        const browserLaunch = await response.json();
        const workspace = page.getByLabel('Agent 学习任务工作区');
        await workspace.waitFor({ timeout: 30000 });
        const browserDetail = await request('/api/v1/csca-special-practice/adaptive/rounds/' + browserLaunch.roundId);
        assert.equal(browserDetail.questions.length, 3);
        const browserQuestion = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: browserDetail.questions[0].id } });
        assert.equal(browserQuestion.designedDifficulty, '较难');
        const directory = path.resolve(__dirname, '../../.local/math-engine');
        fs.mkdirSync(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, 'student-practice.png'), fullPage: true });
        assert.deepEqual(errors, []);
        console.log('MATH_ENGINE_REAL_STUDENT_BROWSER_OK: knowledge point + hard difficulty -> 3 verified questions in existing practice workspace.');
      } finally { await browser.close(); await vite.close(); process.chdir(previousCwd); }
    }
    console.log(JSON.stringify({ status: 'pass', flow: 'student Agent -> generate -> persistent round -> bilingual refresh -> answer -> check -> submit -> learning evidence',
      engineVersion: '1.43.0', roundId: launch.roundId, questionId: question.id, evidenceCount, providerCalls: 0, costUsd: 0 }));
  } finally { await app.close(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
