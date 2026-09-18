const { randomBytes, randomUUID, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();
const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const base = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';
let temporaryAdminId = null;
function assert(value, message) { if (!value) throw new Error(message); }
async function request(pathname, { method = 'GET', token, body, expected = [200, 201] } = {}) {
  const response = await fetch(`${base}${pathname}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
  const text = await response.text();
  let result; try { result = text ? JSON.parse(text) : {}; } catch { result = text; }
  assert(expected.includes(response.status), `${pathname} returned HTTP ${response.status}: ${text.slice(0, 700)}`);
  return result;
}
async function hashPassword(value) { const salt = randomBytes(16).toString('hex'); const key = await scrypt(value, salt, 64); return `scrypt:${salt}:${Buffer.from(key).toString('hex')}`; }

async function main() {
  assert(process.env.NODE_ENV !== 'production' && process.env.MOODLELIKE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'PR12I rehearsal is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), 'PR12I rehearsal only accepts a local database.');
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Run node scripts/agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials });
  const token = login.tokens?.accessToken;
  const userId = Number(login.user?.id);
  assert(token && Number.isInteger(userId), 'Demo login failed.');
  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'M-CALC-001' } });
  assert(topic?.status === 'published', 'Published M-CALC-001 topic is missing.');
  await prisma.learningIntervention.deleteMany({ where: { userId } });
  const proposal = await prisma.learningIntervention.create({ data: {
    decisionKey: `pr12i-${randomUUID()}`, userId, subjectCode: 'math', topicId: topic.id,
    stateVersion: 'pr12i-shadow-live', policyVersion: 'intervention-shadow-v1', action: 'offer_micro_lesson', status: 'shadow_proposed', urgency: 'high', placement: 'between_sets',
    triggerCodes: ['MISCONCEPTION_REPEATED'], suppressionCodes: [], contentPlan: { format: 'mini_lesson', depth: 'guided', verificationRequired: true },
    reasonSummary: 'PR12I 双轨路由实测。', inputSnapshot: { source: 'pr12i_local_rehearsal' }, evidenceCutoffAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  } });
  const conversation = await request('/api/v1/agent/conversations', { method: 'POST', token, body: { title: 'PR12I routing shadow rehearsal' } });
  const offered = await request('/api/v1/agent/interventions/offer', { method: 'POST', token, body: { clientRequestId: randomUUID(), context: 'after_round', conversationId: conversation.id, language: 'zh-CN' } });
  assert(offered.item?.interventionId === proposal.id, 'Expected Shadow proposal was not offered.');
  const started = await request(`/api/v1/agent/intervention-deliveries/${offered.item.id}/actions`, { method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'start' } });
  assert(started.content.teachingAsset?.resolverVersion === 'teaching-asset-resolver-v1', 'Shadow mode must keep the learner on the legacy resolver.');
  assert(!started.content.teachingAsset?.selectionDecision, 'Shadow decision must not leak into the learner presentation.');
  const routingEvent = await prisma.cscaTrainingEvent.findFirst({ where: { userId, eventType: 'teaching_asset_routing_decision', source: 'agent', metadata: { path: ['contextKey'], equals: `intervention:${proposal.id}` } }, orderBy: { createdAt: 'desc' } });
  assert(routingEvent?.metadata?.routingMode === 'shadow', 'Shadow routing decision was not persisted.');
  assert(routingEvent.metadata.policyVersion === 'teaching-asset-selection-v1', 'Shadow policy version is missing.');
  const adminEmail = `pr12i-${randomUUID()}@admin.local`;
  const adminPassword = `Admin-${randomBytes(16).toString('base64url')}`;
  const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), displayName: 'PR12I Admin', role: 'admin', status: 'active', emailVerifiedAt: new Date() } });
  temporaryAdminId = admin.id;
  const adminLogin = await request('/api/v1/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  const diagnostics = await request('/api/v1/admin/teaching-assets/routing-diagnostics?days=30', { token: adminLogin.tokens?.accessToken });
  assert(diagnostics.currentMode === 'shadow' && diagnostics.metrics.decisions >= 1, 'Admin routing diagnostics did not include the live Shadow event.');
  assert(diagnostics.learningOutcomes?.policyVersion === 'teaching-asset-routing-outcome-v1', 'Routing outcome closed-loop report is missing.');
  assert(diagnostics.learningOutcomes.observations >= 1 && diagnostics.learningOutcomes.cohorts.baseline.deliveries >= 1, 'Shadow delivery was not attributed to the baseline outcome cohort.');
  assert(diagnostics.recent.every((item) => !Object.prototype.hasOwnProperty.call(item, 'userId') && typeof item.studentRef === 'string'), 'Admin diagnostics exposed a raw learner id.');
  console.log(JSON.stringify({ verdict: 'pass', proposalId: proposal.id, deliveryId: offered.item.id, learnerResolver: started.content.teachingAsset.resolverVersion, shadowPolicy: routingEvent.metadata.policyVersion, diagnostics: { currentMode: diagnostics.currentMode, decisions: diagnostics.metrics.decisions, qualified: diagnostics.gate.qualified, reasonCodes: diagnostics.gate.reasonCodes, outcomeObservations: diagnostics.learningOutcomes.observations, outcomeCircuit: diagnostics.learningOutcomes.circuit.status } }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(async () => {
  if (temporaryAdminId) await prisma.user.deleteMany({ where: { id: temporaryAdminId } });
  await prisma.$disconnect();
});
