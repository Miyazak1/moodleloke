'use strict';
// Temporary loopback-only real application review. Uses only the guarded acceptance DB.
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
exports.run = async ({ prisma, base, request, nativeQuestion }) => {
  const frontend = path.resolve(__dirname, '../../frontend');
  const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [frontend] })).href);
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.local/question-figures/live-cases.json'))).cases;
  const links = [];
  for (const item of [{ key: 'native', questionId: nativeQuestion.id }, ...cases]) {
    const q = await prisma.cscaQuestion.findUniqueOrThrow({ where: { id: item.questionId } });
    const auth = await request('/api/v1/auth/register', 'POST', { email: 'layout-' + randomUUID() + '@example.test', password: 'Local-layout-review-123!' });
    const userId = Number(auth.user.id), token = auth.tokens.accessToken;
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    const others = await prisma.cscaQuestion.findMany({ where: { topicId: q.topicId, id: { not: q.id } }, select: { id: true } });
    await prisma.cscaQuestionExposure.createMany({ data: others.map(row => ({ userId, questionId: row.id, source: 'adaptive_round:csca_question' })), skipDuplicates: true });
    const response = await fetch(base + '/api/v1/agent/free-practice/start', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ clientRequestId: randomUUID(), subject: 'math', practiceMode: 'single_topic', focusTopicId: q.topicId, questionCount: 1, difficulty: /难|hard/.test(q.designedDifficulty) ? 'hard' : 'basic', questionLanguage: 'zh' }) });
    if (!response.ok) throw Error('Local layout practice launch failed: ' + response.status);
    links.push({ key: item.key, token, launch: await response.json() });
  }
  const cwd = process.cwd(); process.chdir(frontend);
  const server = await createServer({ root: frontend, configFile: path.join(frontend, 'vite.config.mjs'), define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(base), 'import.meta.env.VITE_AGENT_WEB_ENABLED': JSON.stringify('true') }, server: { host: '127.0.0.1', port: 5199, strictPort: true }, plugins: [{ name: 'loopback-layout-review', configureServer(vite) {
    vite.middlewares.use('/__review', async (req, res, next) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      const url = new URL(req.url, 'http://127.0.0.1:5199');
      const item = links.find(link => link.key === url.searchParams.get('case'));
      if (!item) return res.end('<h1>Local student layout review</h1>' + links.map(link => `<p><a href="/__review?case=${link.key}">${link.key}</a> · <a href="/__review?case=${link.key}&lang=en">English</a></p>`).join(''));
      try { await prisma.cscaAdaptiveSession.update({ where: { id: item.launch.sessionId }, data: { questionLanguage: url.searchParams.get('lang') === 'en' ? 'en' : 'zh' } }); } catch (error) { return next(error); }
      const params = new URLSearchParams({ agentRoundId: String(item.launch.roundId), agentArtifactId: item.launch.artifactId, agentContextId: item.launch.conversationId, agentTaskType: 'free_practice', agentSubject: 'math', agentView: 'practice', mode: 'free' });
      res.end('<script>localStorage.setItem("moodlelike.accessToken",' + JSON.stringify(item.token) + ');for(const p of ["moodlelike","cscalite"]){localStorage.setItem(p+".locale",' + JSON.stringify(url.searchParams.get('lang') === 'en' ? 'en' : 'zh-CN') + ');localStorage.setItem(p+".localeSource","manual")}location.replace(' + JSON.stringify('/agent?' + params) + ')</script>');
    });
  } }] });
  await server.listen();
  console.log('LOCAL_LAYOUT_REVIEW_READY http://127.0.0.1:5199/__review');
  await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  await server.close(); process.chdir(cwd);
};
