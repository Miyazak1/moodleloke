'use strict';
// Dedicated loopback acceptance DB only; no .env or external Provider access.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const database = process.env.MATH_ENGINE_ACCEPTANCE_DATABASE_URL;
const url = new URL(database);
const localHost = ['127.0.0.1', 'localhost'].includes(url.hostname)
  || (process.env.MATH_ENGINE_ACCEPTANCE_DOCKER === 'local' && url.hostname === 'host.docker.internal');
assert.ok(localHost && url.pathname === '/moodlelike_math_engine_acceptance', 'Refusing non-acceptance DB');
for (const key of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|SMTP|DATABASE|REDIS|PROVIDER|^CSCA_|^AGENT_|^MOODLELIKE_|^CSC_ENV$/.test(key)) delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: 'test', MOODLELIKE_ENV: 'test', DATABASE_URL: database, AUTH_SECRET: 'math-topic-matrix-local-secret-only',
  AGENT_WEB_ENABLED: 'true', CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true', CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  MOODLELIKE_MATH_ENGINE_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ENABLED: 'true', QUESTION_ENGINE_PLUGIN_ID: 'verified-math-1.43',
  CSCA_AI_QUESTION_GENERATION_ENABLED: 'false', CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'false', CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'false'
});
const realFetch = globalThis.fetch;
globalThis.fetch = (address, options) => {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname), 'External Provider forbidden');
  return realFetch(address, options);
};
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/backend/src/app.module.js');
const { PrismaService } = require('../dist/backend/src/prisma/prisma.service.js');
const { QuestionEnginePluginRegistryService } = require('../dist/backend/src/question-engine-plugin/question-engine-plugin-registry.service.js');
const { verifiedMathCellsForTopic, verifiedMathScopeMatches } = require('../dist/backend/src/question-engine-plugin/verified-math-topic-binding.js');
const legacy = [
  ['math-plane-geometry', '平面解析几何'], ['math-solid-vector', '向量'], ['math-complex', '复数'],
  ['math-solid-geometry', '立体几何'], ['math-coordinate-geometry', '空间直角坐标系'],
  ['math-function-basic', '基本初等函数'], ['math-sequence', '数列'], ['math-function', '函数'],
  ['math-calculus', '导数与微积分'], ['math-probability', '概率与统计'], ['math-inequality', '不等式'], ['math-set', '集合']
];
const filter = process.argv.find(arg => arg.startsWith('--codes='))?.slice(8).split(',');
const bands = process.argv.find(arg => arg.startsWith('--bands='))?.slice(8).split(',') ?? ['basic', 'medium', 'hard'];
const count = Number(process.argv.find(arg => arg.startsWith('--count='))?.slice(8) ?? 3);
assert.ok([3, 5, 10].includes(count));
assert.ok(bands.every(band => ['basic', 'medium', 'hard'].includes(band)));
const directory = path.resolve(__dirname, '../../artifacts/math-topic-matrix');
fs.mkdirSync(directory, { recursive: true });
const resumeFiles = process.argv.find(arg => arg.startsWith('--resume='))?.slice(9).split(',') ?? [];
const completed = new Set();
for (const file of resumeFiles) {
  assert.equal(file, path.basename(file), 'Resume must name an artifact file, not an arbitrary path');
  const prior = JSON.parse(fs.readFileSync(path.join(directory, file)));
  assert.equal(prior.count, count);
  for (const row of prior.results) if (['pass', 'bank_only_pass'].includes(row.state)) completed.add(row.code + ':' + row.difficulty);
}
const results = [];
const outputFile = path.join(directory, 'run-' + Date.now() + '.json');
const save = () => fs.writeFileSync(outputFile, JSON.stringify({ generatedAt: new Date().toISOString(), count, resumeFiles, results, providerCalls: 0, costUsd: 0 }, null, 2));
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const catalog = app.get(QuestionEnginePluginRegistryService).mathCatalog().cells;
  const topics = [...legacy, ...catalog.filter(cell => cell.difficulty === 'basic').map(cell => [cell.topicCode, cell.title])]
    .filter(([code]) => !filter || filter.includes(code));
  let token;
  const seenIdentities = new Set();
  const base = await app.getUrl();
  async function request(route, method = 'GET', input) {
    const response = await fetch(base + route, { method, signal: AbortSignal.timeout(180000), headers: {
      'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {})
    }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const value = await response.json();
    assert.ok(response.ok, route + ' ' + response.status + ' ' + JSON.stringify(value));
    return value;
  }
  try {
    const credentials = { email: 'math-matrix-' + randomUUID() + '@example.test', password: 'Matrix-acceptance-only-123!' };
    const auth = await request('/api/v1/auth/register', 'POST', credentials);
    token = auth.tokens.accessToken;
    const userId = Number(auth.user.id);
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    for (const [code, title] of topics) {
      const topic = await prisma.cscaExamTopic.upsert({ where: { code }, create: { code, title, subject: 'math', status: 'published', syllabusVersion: '2025' }, update: {} });
      for (const difficulty of bands) {
        if (completed.has(code + ':' + difficulty)) continue;
        // Long matrices may outlive the 15-minute access token. Renew through
        // the ordinary login endpoint instead of weakening token validation.
        token = (await request('/api/v1/auth/login', 'POST', credentials)).tokens.accessToken;
        const started = Date.now();
        const row = { code, title, difficulty, count, state: 'running' };
        results.push(row); save();
        try {
          const bankOnly = !verifiedMathCellsForTopic(code, difficulty, catalog).length;
          if (bankOnly) {
            assert.equal(code, 'math-coordinate-geometry', 'unexpected unbound production topic');
            // Acceptance fixtures prove the retained bank route, not generator coverage.
            for (let index = 1; index <= 2 * count; index++) {
              const prompt = `LOCAL MATRIX BANK ${difficulty} ${index}: 空间点 A(0,0,0)、B(${3 * index},${4 * index},${12 * index}) 的距离是多少？`;
              if (!await prisma.cscaQuestion.findFirst({ where: { topicId: topic.id, prompt } })) await prisma.cscaQuestion.create({ data: {
                subject: 'math', topicId: topic.id, sourceType: 'external_oer', status: 'approved', syllabusVersion: topic.syllabusVersion,
                designedDifficulty: { basic: '基础', medium: '中等', hard: '较难' }[difficulty], questionType: 'single_choice', prompt,
                options: ['A', 'B', 'C', 'D'].map((id, offset) => ({ id, text: String(13 * index + offset) })),
                correctAnswer: 'A', explanation: 'sqrt((3n)^2+(4n)^2+(12n)^2)=13n', knowledgeTags: ['空间直角坐标系', 'local_acceptance_fixture']
              } });
            }
          }
          const old = await prisma.cscaQuestion.findMany({ where: { topicId: topic.id }, select: { id: true } });
          if (old.length && !bankOnly) await prisma.cscaQuestionExposure.createMany({ data: old.map(question => ({ userId, questionId: question.id, source: 'adaptive_round:csca_question' })), skipDuplicates: true });
          const config = { subject: 'math', practiceMode: 'single_topic', focusTopicId: topic.id, difficulty, questionCount: count, questionLanguage: 'zh' };
          const launch = await request('/api/v1/agent/free-practice/start', 'POST', { ...config, clientRequestId: randomUUID() });
          const used = new Set();
          async function complete(batch) {
            const route = '/api/v1/csca-special-practice/adaptive/rounds/' + batch.roundId;
            const detail = await request(route);
            assert.equal(detail.questions.length, count);
            const answers = {}, timeSpent = {};
            for (const question of detail.questions) {
              assert.equal(used.has(question.id), false, 'duplicate across batches'); used.add(question.id);
              for (const key of ['correctAnswer', 'explanation', 'generationSource', 'sourceVerification']) assert.equal(Object.hasOwn(question, key), false, 'answer/evidence leak');
              const stored = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: question.id } });
              assert.equal(stored.topicId, topic.id); assert.equal(stored.sourceType, bankOnly ? 'external_oer' : 'verified_math_engine');
              assert.equal(stored.designedDifficulty, { basic: '基础', medium: '中等', hard: '较难' }[difficulty]);
              if (!bankOnly) {
                const meta = stored.generationMetadata;
                assert.equal(meta.hostTopicCode, code);
                assert.ok(verifiedMathScopeMatches(code, difficulty, meta.cellId, meta.scopeId, catalog), 'cross-topic scope publication');
                const identity = meta.scopeId + ':' + meta.mathIdentityHash;
                assert.equal(seenIdentities.has(identity), false, 'same mathematical instance across aliases'); seenIdentities.add(identity);
                assert.equal(stored.reviewMetadata.mathEngine.providerCalls, 0);
              }
              assert.equal((await request(route + '/check', 'POST', { questionId: question.id, selected: stored.correctAnswer })).isCorrect, true);
              answers[question.id] = stored.correctAnswer; timeSpent[question.id] = 12;
            }
            const en = await request(route + '?language=en');
            assert.deepEqual(en.questions.map(question => question.id), detail.questions.map(question => question.id));
            await request(route, 'PATCH', { answers, timeSpent });
            const report = await request(route + '/submit', 'POST', {});
            assert.ok(report.items.every(item => item.isCorrect));
            await request('/api/v1/agent/practice-rounds/' + batch.roundId + '/settle', 'POST');
          }
          await complete(launch);
          const nextInput = { ...config, clientRequestId: randomUUID() };
          const next = await request('/api/v1/agent/free-practice/' + launch.artifactId + '/continue', 'POST', nextInput);
          const repeat = await request('/api/v1/agent/free-practice/' + launch.artifactId + '/continue', 'POST', nextInput);
          assert.equal(repeat.roundId, next.roundId, 'successor idempotency');
          await complete(next);
          await request('/api/v1/agent/free-practice/' + next.artifactId + '/end', 'POST', { clientRequestId: randomUUID() });
          Object.assign(row, { state: bankOnly ? 'bank_only_pass' : 'pass', generationAvailable: !bankOnly, rounds: [launch.roundId, next.roundId], distinctQuestions: used.size, durationMs: Date.now() - started });
          console.log('MATRIX_PASS', code, difficulty, used.size, row.durationMs + 'ms', row.state);
        } catch (error) {
          Object.assign(row, { state: 'fail', error: error.message, durationMs: Date.now() - started });
          console.error('MATRIX_FAIL', code, difficulty, error.message);
        }
        save();
      }
    }
    assert.ok(!results.some(row => row.state === 'fail'), 'matrix contains failed flows: ' + outputFile);
    console.log('MATRIX_COMPLETE', outputFile, results.length);
  } finally { save(); await app.close(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
