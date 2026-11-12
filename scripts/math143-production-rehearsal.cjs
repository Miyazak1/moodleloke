'use strict';
// Runs ONLY against a new local Docker project. Never reads repository .env.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const layoutMode = process.argv.includes('--layout');
const figuresMode = layoutMode || process.argv.includes('--figures');
const directory = path.join(root, '.local', layoutMode ? 'math143-layout-release' : figuresMode ? 'math143-figures-release' : 'math143-release');
fs.mkdirSync(directory, { recursive: true });
const project = (layoutMode ? 'moodlelike-math143-layout-rehearsal-' : figuresMode ? 'moodlelike-math143-figures-rehearsal-' : 'moodlelike-math143-rehearsal-') + Date.now();
const envFile = path.join(directory, project + '.env');
const composeFile = path.join(root, 'deploy/docker-compose.math143-rehearsal.yml');
const rollbackFile = path.join(root, 'deploy/docker-compose.math143-rehearsal-bank-only.yml');
const base = 'http://127.0.0.1:18091';
const evidence = { schemaVersion: 'math143-production-rehearsal-v1', startedAt: new Date().toISOString(), project, figuresMode, layoutMode,
  remoteSitesContacted: false, sourceBindMounts: false, providerCredentials: 'fake_unused_offline', checks: [] };
const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) if (/^MATH143_REHEARSAL_|^COMPOSE_/.test(key)) delete childEnv[key];
function run(args, input, binary = false) {
  const result = spawnSync('docker', args, { cwd: root, env: childEnv, input,
    encoding: binary ? undefined : 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 900000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Docker command failed: ' + args.slice(0, 5).join(' ') + '\n' + String(result.stderr).slice(-4000));
  return result.stdout;
}
function compose(args, input, binary = false, rollback = false) {
  return run(['compose', '--env-file', envFile, '-p', project, '-f', composeFile,
    ...(rollback ? ['-f', rollbackFile] : []), ...args], input, binary);
}
function check(name) { evidence.checks.push(name); console.log('[rehearsal] ' + name); }
function image(tag) { return JSON.parse(run(['image', 'inspect', tag]))[0].Id; }
function db(code, database = 'moodlelike_math143_rehearsal') {
  assert.ok(['moodlelike_math143_rehearsal', 'moodlelike_math143_restore'].includes(database));
  const script = `const {PrismaClient}=require('./backend/node_modules/@prisma/client');const u=new URL(process.env.DATABASE_URL);u.pathname=${JSON.stringify('/' + database)};const p=new PrismaClient({datasources:{db:{url:u.href}}});(async()=>{${code}})().then(v=>console.log(JSON.stringify(v))).finally(()=>p.$disconnect()).catch(e=>{console.error(e);process.exitCode=1});`;
  return JSON.parse(compose(['exec', '-T', 'backend', 'node', '-e', script]).trim());
}
function snapshot(database) {
  return db(`const crypto=require('node:crypto');const tables=await p.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");const rows=[];for(const {tablename:t} of tables){if(!/^[a-zA-Z0-9_]+$/.test(t))throw Error('invalid_table');const data=await p.$queryRawUnsafe('SELECT row_to_json(r)::text AS data FROM "'+t+'" r ORDER BY row_to_json(r)::text');rows.push({table:t,count:data.length,sha256:crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')});}return rows;`, database);
}
let token;
async function request(route, method = 'GET', body, expected = 200) {
  assert.equal(new URL(base + route).hostname, '127.0.0.1');
  const response = await fetch(base + route, { method, signal: AbortSignal.timeout(180000), headers: {
    'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  assert.equal(response.status, expected, route + ': ' + text.slice(0, 1000));
  return JSON.parse(text);
}
async function ready(expectedEngine) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(base + '/api/v1/ops/ready', { headers: { authorization: 'Bearer ' + secrets.MATH143_REHEARSAL_READY_TOKEN }, signal: AbortSignal.timeout(3000) });
      const data = await response.json();
      if (data.status === 'ready' && data.database.connected && data.questionEngine.status === expectedEngine) return data;
    } catch { /* Nginx DNS cache and Nest startup may still be settling. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error('Production image readiness did not reach ' + expectedEngine);
}
const secrets = Object.fromEntries(['DB_PASSWORD','AUTH_SECRET','PAYMENT_SECRET','READY_TOKEN'].map(key => ['MATH143_REHEARSAL_' + key, randomBytes(32).toString('hex')]));
async function main() {
  const context = run(['context', 'show']).trim();
  const endpoint = JSON.parse(run(['context', 'inspect', context]))[0].Endpoints.docker.Host;
  assert.match(endpoint, /^(?:npipe|unix):\/\//, 'Refusing a remote Docker context');
  evidence.images = {
    backend: image(figuresMode ? 'moodlelike-backend:math143-figures-rc-local' : 'moodlelike-backend:math143-rc-local'),
    frontend: image(layoutMode ? 'moodlelike-frontend:math143-layout-rc-local' : figuresMode ? 'moodlelike-frontend:math143-figures-rc-local' : 'moodlelike-frontend:math143-rc-local'),
    migrate: image('moodlelike-backend:math143-migrate-local')
  };
  fs.writeFileSync(envFile, Object.entries({ ...secrets, MATH143_REHEARSAL_BACKEND_IMAGE: evidence.images.backend,
    MATH143_REHEARSAL_FRONTEND_IMAGE: evidence.images.frontend, MATH143_REHEARSAL_MIGRATE_IMAGE: evidence.images.migrate }).map(([key, value]) => key + '=' + value).join('\n') + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(directory, 'latest-project.json'), JSON.stringify({ project, envFile, composeFile }, null, 2));
  console.log('[rehearsal] Creating isolated local project ' + project);
  compose(['up', '-d', 'frontend']);
  await ready('ready');
  check('production_entrypoint_and_nginx_readiness');
  const id = compose(['ps', '-q', 'backend']).trim();
  assert.equal(JSON.parse(run(['inspect', id]))[0].Mounts.length, 0, 'Backend must not use host engine files');
  const network = JSON.parse(run(['network', 'inspect', project + '_offline']))[0];
  assert.equal(network.Internal, true);
  check('internal_network_no_backend_source_mounts');
  const frozen = JSON.parse(compose(['exec', '-T', 'backend', 'node', '-e', 'console.log(JSON.stringify(require("./question-engine/math-v143/runtime.cjs").catalog()))']));
  assert.equal(frozen.applicationVersion, '1.43.0'); assert.equal(frozen.cells.length, 36);
  assert.equal(frozen.cells.reduce((n, cell) => n + cell.scopes.length, 0), 141);
  check('frozen_archive_and_1152_files_verified_inside_image');
  const fixtures = db(`const topics=[];for(const subject of ['math','physics','chemistry']){const t=await p.cscaExamTopic.create({data:{code:'REHEARSAL-BANK-'+subject,title:subject+'现有题库',subject,status:'published',syllabusVersion:'2025'}});const q=await p.cscaQuestion.create({data:{topicId:t.id,subject,status:'approved',sourceType:'external_oer',designedDifficulty:'基础',syllabusVersion:'2025',questionType:'single_choice',prompt:subject+'现有题目，选择 A',options:['A','B','C','D'].map(id=>({id,text:id})),correctAnswer:'A',explanation:'原有题库解析',knowledgeTags:[]}});topics.push({subject,topicId:t.id,questionId:q.id});}const math=await p.cscaExamTopic.create({data:{code:'M-GEO-002',title:'空间几何',subject:'math',status:'published',syllabusVersion:'2025'}});return {topics,math};`);
  const auth = await request('/api/v1/auth/register', 'POST', { email: 'math143-' + randomUUID() + '@example.test', password: 'Rehearsal-local-student-password-123!' }, 201);
  token = auth.tokens.accessToken;
  const userId = Number(auth.user.id);
  db(`return p.user.update({where:{id:${userId}},data:{emailVerifiedAt:new Date()}}).then(u=>u.id);`);
  const input = { clientRequestId: randomUUID(), subject: 'math', practiceMode: 'single_topic', focusTopicId: fixtures.math.id,
    difficulty: 'hard', questionCount: 3, questionLanguage: 'zh' };
  const launch = await request('/api/v1/agent/free-practice/start', 'POST', input, 201);
  assert.equal((await request('/api/v1/agent/free-practice/start', 'POST', input, 201)).roundId, launch.roundId);
  const route = '/api/v1/csca-special-practice/adaptive/rounds/' + launch.roundId;
  const detail = await request(route);
  assert.equal(detail.questions.length, 3);
  if (figuresMode) { assert.ok(detail.questions.every(q => q.figure?.phase === 'question'), 'native figures must be packaged and bound to their questions'); check('native_figures_bound_in_production_image'); }
  for (const language of ['zh', 'en']) {
    const round = await request(route + '?language=' + language);
    assert.doesNotMatch(JSON.stringify(round.questions), /"(?:correctAnswer|explanation|sourceCandidate|sourceVerification|questionArtifact)"/);
  }
  const stored = db(`return p.cscaQuestion.findMany({where:{id:{in:${JSON.stringify(detail.questions.map(q => q.id))}}}});`);
  const answers = {};
  for (const q of stored) {
    assert.equal(q.sourceType, 'verified_math_engine'); assert.equal(q.generationMetadata.engineVersion, '1.43.0');
    assert.equal(q.reviewMetadata.publication.state, 'published'); assert.equal(q.reviewMetadata.mathEngine.providerCalls, 0);
    assert.equal(q.designedDifficulty, '较难'); answers[q.id] = q.correctAnswer;
    assert.equal((await request(route + '/check', 'POST', { questionId: q.id, selected: q.correctAnswer }, 201)).isCorrect, true);
  }
  await request(route, 'PATCH', { answers, timeSpent: Object.fromEntries(stored.map(q => [q.id, 15])) });
  const report = await request(route + '/submit', 'POST', {}, 201);
  assert.ok(report.items.every(item => item.isCorrect));
  await request(route + '/submit', 'POST', {}, 201);
  assert.equal(db(`return p.learningEvidenceEvent.count({where:{userId:${userId},sourceId:${JSON.stringify(String(launch.roundId))}}});`), 3);
  check('student_generate_publish_bilingual_check_submit_and_idempotent_evidence');
  if (process.argv.includes('--cua')) {
    const browserFile = path.join(directory, project + '-browser-complete.json');
    fs.writeFileSync(path.join(directory, 'browser-handoff.private.json'), JSON.stringify({ base, token, topicId: fixtures.math.id, browserFile }, null, 2), { mode: 0o600 });
    console.log('[rehearsal] CUA_BROWSER_READY ' + path.relative(root, directory));
    const deadline = Date.now() + 15 * 60 * 1000;
    while (!fs.existsSync(browserFile)) {
      if (Date.now() > deadline) throw Error('CUA browser verification not completed within 15 minutes');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const browserEvidence = JSON.parse(fs.readFileSync(browserFile, 'utf8'));
    assert.equal(browserEvidence.status, 'pass');
    assert.equal(browserEvidence.project, project);
    assert.equal(db("return p.cscaQuestion.count({where:{sourceType:'verified_math_engine'}});"), stored.length + 3);
    evidence.browser = browserEvidence;
  } else {
  const { chromium } = require('../frontend/node_modules/@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.addInitScript(value => { localStorage.setItem('moodlelike.accessToken', value);localStorage.setItem('moodlelike.agent.learningMode','free');localStorage.setItem('moodlelike.locale','zh-CN');localStorage.setItem('cscalite.locale','zh-CN'); }, token);
    await page.goto(base + '/agent?mode=free&subject=math');
    const card = page.locator('.agent-free-practice-card');
    await card.getByRole('radio', { name: '按知识点练习', exact: true }).click();
    await card.locator('.agent-free-practice-topic-picker select').first().selectOption(String(fixtures.math.id));
    await card.getByLabel('题目难度', { exact: true }).selectOption('hard');
    await card.getByRole('radio', { name: '3 题', exact: true }).click();
    const response = page.waitForResponse(r => r.url().endsWith('/api/v1/agent/free-practice/start') && r.request().method() === 'POST', { timeout: 180000 });
    await card.getByRole('button', { name: '开始练习', exact: true }).click();
    assert.equal((await response).status(), 201);
    await page.getByLabel('Agent 学习任务工作区').waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(directory, 'production-student.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  }
  check('production_frontend_browser_to_nginx_to_frozen_worker');
  const before = snapshot('moodlelike_math143_rehearsal');
  const backup = compose(['exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '-d', 'moodlelike_math143_rehearsal', '--format=custom', '--no-owner', '--no-privileges'], undefined, true);
  assert.ok(backup.length > 1000);
  const backupFile = path.join(directory, project + '.dump'); fs.writeFileSync(backupFile, backup, { mode: 0o600 });
  evidence.backup = { file: path.relative(root, backupFile), bytes: backup.length, sha256: createHash('sha256').update(backup).digest('hex') };
  compose(['exec', '-T', 'db', 'createdb', '-U', 'postgres', 'moodlelike_math143_restore']);
  compose(['exec', '-T', 'db', 'pg_restore', '-U', 'postgres', '-d', 'moodlelike_math143_restore', '--exit-on-error', '--no-owner', '--no-privileges'], backup);
  assert.deepEqual(snapshot('moodlelike_math143_restore'), before);
  evidence.restoredTables = before;
  check('custom_dump_restore_all_public_tables_identical');
  compose(['run', '--rm', 'migrate']);
  check('migration_deploy_idempotent');
  compose(['up', '-d', '--no-deps', 'backend'], undefined, false, true);
  await ready('inactive');
  for (const fixture of fixtures.topics) {
    const session = db(`return p.cscaAdaptiveSession.create({data:{userId:${userId},subject:${JSON.stringify(fixture.subject)},mode:'practice',questionLanguage:'zh'}});`);
    const round = await request('/api/v1/csca-special-practice/adaptive/sessions/' + session.id + '/rounds', 'POST', {
      questionCount: 1, focusTopicId: fixture.topicId, topicMode: 'single_topic', difficulty: 'basic'
    }, 201);
    assert.equal(round.questions[0].id, fixture.questionId);
    const r = '/api/v1/csca-special-practice/adaptive/rounds/' + round.round.id;
    assert.equal((await request(r + '/check', 'POST', { questionId: fixture.questionId, selected: 'A' }, 201)).isCorrect, true);
    await request(r, 'PATCH', { answers: { [fixture.questionId]: 'A' }, timeSpent: { [fixture.questionId]: 5 } });
    assert.equal((await request(r + '/submit', 'POST', {}, 201)).items[0].isCorrect, true);
  }
  assert.equal(db("return p.cscaQuestion.count({where:{sourceType:'verified_math_engine'}});"), stored.length + 3);
  check('bank_only_rollback_preserves_three_subject_answer_flows');
  compose(['up', '-d', '--no-deps', 'backend']);
  await ready('ready');
  check('formal_plugin_reenabled_without_data_restore');
  evidence.status = 'pass'; evidence.completedAt = new Date().toISOString(); evidence.providerCalls = 0;
}
main().catch(error => { evidence.status = 'failed'; evidence.error = error.message; console.error(error.message); process.exitCode = 1; }).finally(() => {
  fs.writeFileSync(path.join(directory, 'production-rehearsal-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  // Keep this isolated database and the dump for inspection; stop only our new project.
  if (fs.existsSync(envFile)) { try { compose(['stop', '--timeout', '60']); } catch (error) { console.error('Local rehearsal stop failed: ' + error.message); } }
  console.log('[rehearsal] Result: ' + evidence.status + '; evidence under ' + path.relative(root, directory) + '/');
});
