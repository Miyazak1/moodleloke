const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv();
const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);
const base = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';
const marker = `pr12e-${Date.now()}-${randomBytes(4).toString('hex')}`;
const adminEmail = `${marker}@admin.local`;
const studentEmail = `${marker}@student.local`;
const password = `Admin-${randomBytes(16).toString('base64url')}`;
let assetId = null;
let qualityAlertKey = null;
const versionIds = [];

function assert(value, message) { if (!value) throw new Error(message); }
function assertLocalDatabase() {
  assert(process.argv.includes('--apply'), 'Refusing to write without --apply.');
  assert(process.env.NODE_ENV !== 'production' && process.env.MOODLELIKE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'PR12E live test is disabled in production.');
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(url.hostname), `PR12E live test only accepts a local database, received ${url.hostname || 'unset'}.`);
}
async function hashPassword(value) { const salt = randomBytes(16).toString('hex'); const key = await scrypt(value, salt, 64); return `scrypt:${salt}:${Buffer.from(key).toString('hex')}`; }
async function request(pathname, { method = 'GET', token, body, expected = [200, 201] } = {}) {
  const response = await fetch(`${base}${pathname}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
  const text = await response.text(); let result;
  try { result = text ? JSON.parse(text) : {}; } catch { result = text; }
  assert(expected.includes(response.status), `${pathname} returned HTTP ${response.status}: ${text.slice(0, 800)}`);
  return result;
}

function validInput(topic) {
  const payload = {
    schemaVersion: '1', title: 'PR12E 生命周期测试微课', summary: '仅用于本地后台运营闭环验收。', instructions: ['调节参数。', '观察顶点。', '回答即时检查。'],
    component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
    activePrompt: { id: 'pr12e-check', prompt: 'h=2 时顶点在哪里？', options: [{ id: 'left', label: '(-2,0)' }, { id: 'right', label: '(2,0)' }], correctAnswer: 'right', correctFeedback: '正确。', incorrectFeedback: '再观察一次。' },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  return {
    language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3, renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1', payloadSchemaVersion: 'function-horizontal-shift-v1', payload,
    fallbackPayload: { title: payload.title, body: 'y=(x-h)² 的顶点是 (h,0)。' }, sourceRefs: [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion }], topicIds: [topic.id]
  };
}

async function main() {
  assertLocalDatabase();
  const passwordHash = await hashPassword(password);
  const [admin, student, topic] = await Promise.all([
    prisma.user.create({ data: { email: adminEmail, passwordHash, displayName: 'PR12E Admin', role: 'admin', status: 'active', emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { email: studentEmail, passwordHash, displayName: 'PR12E Student', role: 'student', status: 'active', emailVerifiedAt: new Date() } }),
    prisma.cscaExamTopic.findFirst({ where: { subject: 'math', status: 'published' }, orderBy: { id: 'asc' } })
  ]);
  assert(admin && student && topic, 'Local admin, student, or published math topic is missing.');
  const adminLogin = await request('/api/v1/auth/login', { method: 'POST', body: { email: adminEmail, password } });
  const studentLogin = await request('/api/v1/auth/login', { method: 'POST', body: { email: studentEmail, password } });
  const adminToken = adminLogin.tokens?.accessToken; const studentToken = studentLogin.tokens?.accessToken;
  assert(adminToken && studentToken, 'Ephemeral login failed.');
  await request('/api/v1/admin/teaching-assets', { token: studentToken, expected: [403] });

  const input = validInput(topic);
  const created = await request('/api/v1/admin/teaching-assets', { method: 'POST', token: adminToken, body: { ...input, stableKey: `math.${marker}`, subjectCode: 'math', type: 'micro_lesson' } });
  assetId = created.item.id; versionIds.push(created.item.versions[0].id);
  assert(created.item.status === 'draft' && created.item.versions[0].status === 'draft', 'Create did not produce a draft.');
  await request(`/api/v1/admin/teaching-assets/versions/${versionIds[0]}`, { method: 'PATCH', token: adminToken, expected: [400], body: { ...input, componentKey: 'physics.newton-second-law' } });
  const submitted = await request(`/api/v1/admin/teaching-assets/versions/${versionIds[0]}/submit`, { method: 'POST', token: adminToken });
  assert(submitted.item.versions[0].status === 'review', 'Draft was not submitted for review.');
  const approved = await request(`/api/v1/admin/teaching-assets/versions/${versionIds[0]}/approve`, { method: 'POST', token: adminToken });
  assert(approved.item.versions[0].status === 'approved' && approved.item.versions[0].reviewedByUserId === admin.id, 'Review attribution was not persisted.');
  const published = await request(`/api/v1/admin/teaching-assets/versions/${versionIds[0]}/publish`, { method: 'POST', token: adminToken });
  assert(published.item.status === 'published' && published.item.versions[0].status === 'published', 'Approved version was not published.');
  const publicV1 = await request(`/api/v1/agent/teaching-assets/math.${marker}?language=zh-CN`, { token: studentToken });
  assert(publicV1.item.version === 1 && !JSON.stringify(publicV1).includes('correctAnswer'), 'Published V1 was unavailable or leaked its answer key.');

  const next = await request(`/api/v1/admin/teaching-assets/${assetId}/versions`, { method: 'POST', token: adminToken });
  const v2 = next.item.versions[0]; versionIds.push(v2.id);
  assert(v2.version === 2 && v2.status === 'draft' && next.item.status === 'published', 'Creating V2 interrupted the published V1.');
  const publicDuringDraft = await request(`/api/v1/agent/teaching-assets/math.${marker}?language=zh-CN`, { token: studentToken });
  assert(publicDuringDraft.item.version === 1, 'V1 stopped serving while V2 was a draft.');
  const v2Input = validInput(topic); v2Input.payload.title = 'PR12E 生命周期测试微课 v2'; v2Input.fallbackPayload.title = v2Input.payload.title;
  await request(`/api/v1/admin/teaching-assets/versions/${v2.id}`, { method: 'PATCH', token: adminToken, body: v2Input });
  await request(`/api/v1/admin/teaching-assets/versions/${v2.id}/submit`, { method: 'POST', token: adminToken });
  await request(`/api/v1/admin/teaching-assets/versions/${v2.id}/approve`, { method: 'POST', token: adminToken });
  const publishedV2 = await request(`/api/v1/admin/teaching-assets/versions/${v2.id}/publish`, { method: 'POST', token: adminToken });
  assert(publishedV2.item.versions.find((version) => version.id === versionIds[0])?.status === 'retired' && publishedV2.item.versions[0].status === 'published', 'Publishing V2 did not retire V1 atomically.');
  const publicV2 = await request(`/api/v1/agent/teaching-assets/math.${marker}?language=zh-CN`, { token: studentToken });
  assert(publicV2.item.version === 2, 'Resolver did not switch to published V2.');
  const contexts = Array.from({ length: 10 }, (_, index) => `intervention_delivery:${marker}-${index}`);
  await prisma.teachingAssetExposure.createMany({ data: contexts.map((contextKey) => ({
    userId: student.id, assetId, assetVersionId: v2.id, contextKey, source: 'agent_intervention', exposureLevel: 'A4', status: 'completed', snapshot: {}, completedAt: new Date()
  })) });
  await prisma.teachingInteractionEvent.createMany({ data: contexts.map((contextKey, index) => ({
    userId: student.id, assetVersionId: v2.id, contextKey, clientRequestId: `${marker}-prompt-${index}`, action: 'active_prompt_answered', payload: { value: 'right' }, result: { correct: true }
  })) });
  const intervention = await prisma.learningIntervention.create({ data: {
    decisionKey: `${marker}-effectiveness`, userId: student.id, subjectCode: 'math', topicId: topic.id, stateVersion: 'pr12f-live', policyVersion: 'pr12f-live', action: 'offer_micro_lesson', status: 'completed', urgency: 'medium', placement: 'between_sets', triggerCodes: ['test'], suppressionCodes: [], reasonSummary: 'PR12F analytics rehearsal', inputSnapshot: {}, expiresAt: new Date(Date.now() + 60_000)
  } });
  const delivery = await prisma.learningInterventionDelivery.create({ data: {
    interventionId: intervention.id, userId: student.id, status: 'completed', contentSourceType: 'teaching_asset', contentSourceId: assetId, contentSourceVersion: v2.id, contextSnapshot: {}, completedAt: new Date()
  } });
  for (const phase of ['immediate', 'retention', 'transfer']) {
    const verification = await prisma.learningInterventionVerification.create({ data: {
      deliveryId: delivery.id, interventionId: intervention.id, userId: student.id, subjectCode: 'math', topicId: topic.id, status: 'completed', phase,
      selectionVersion: 'pr12f-live', measurementVersion: 'pr12f-live', contentSourceVersion: v2.id, questionRefs: [], supplySnapshot: {}, selectionConstraints: {}, offerRequestId: `${marker}-${phase}`, completedAt: new Date(), expiresAt: new Date(Date.now() + 60_000)
    } });
    await prisma.learningInterventionOutcome.create({ data: {
      verificationId: verification.id, deliveryId: delivery.id, interventionId: intervention.id, userId: student.id, result: 'passed', correctCount: 3, totalCount: 3, accuracy: 1, independent: true, evidenceRefs: [], measurementVersion: 'pr12f-live'
    } });
  }
  await prisma.learningInterventionStabilityAssessment.create({ data: {
    deliveryId: delivery.id, interventionId: intervention.id, userId: student.id, status: 'completed', result: 'stable', policyVersion: 'pr12f-live', phaseResults: {}, evidenceRefs: [], evaluatedAt: new Date()
  } });
  const analytics = await request(`/api/v1/admin/teaching-assets/${assetId}/analytics?days=30`, { token: adminToken });
  assert(analytics.aggregate.exposureContexts === 10 && analytics.aggregate.completedContexts === 10, 'Exposure and completion aggregation is incorrect.');
  assert(analytics.aggregate.activePrompt.firstAttempts === 10 && analytics.aggregate.activePrompt.firstTryCorrectRate === 1, 'First-attempt prompt aggregation is incorrect.');
  assert(analytics.aggregate.independentVerification.total === 3 && analytics.aggregate.independentVerification.passRate === 1, 'Independent verification aggregation is incorrect.');
  assert(analytics.aggregate.stability.stable === 1 && analytics.aggregate.operationalSignal.signal === 'insufficient_data' && analytics.aggregate.operationalSignal.automaticAction === false, 'Small-cohort safety signal or stability aggregation is incorrect.');
  const qualityQueue = await request('/api/v1/admin/teaching-assets/quality-alerts?days=30', { token: adminToken });
  const alert = qualityQueue.items.find((item) => item.asset.id === assetId);
  assert(alert?.signal === 'insufficient_data' && alert.workflow.status === 'open', 'Expected small-cohort quality alert was not opened.');
  qualityAlertKey = alert.alertKey;
  const acknowledged = await request(`/api/v1/admin/teaching-assets/quality-alerts/${encodeURIComponent(qualityAlertKey)}/actions`, { method: 'POST', token: adminToken, body: { action: 'acknowledge', reason: 'PR12G 本地验收确认跟进' } });
  assert(acknowledged.items.find((item) => item.alertKey === qualityAlertKey)?.workflow.status === 'acknowledged', 'Quality alert acknowledge state was not persisted.');
  const resolved = await request(`/api/v1/admin/teaching-assets/quality-alerts/${encodeURIComponent(qualityAlertKey)}/actions`, { method: 'POST', token: adminToken, body: { action: 'resolve', reason: 'PR12G 本地验收标记解决' } });
  assert(resolved.items.find((item) => item.alertKey === qualityAlertKey)?.workflow.status === 'resolved', 'Quality alert resolve state was not persisted.');
  const reopened = await request(`/api/v1/admin/teaching-assets/quality-alerts/${encodeURIComponent(qualityAlertKey)}/actions`, { method: 'POST', token: adminToken, body: { action: 'reopen', reason: 'PR12G 本地验收重新打开' } });
  assert(reopened.items.find((item) => item.alertKey === qualityAlertKey)?.workflow.status === 'open', 'Quality alert reopen state was not persisted.');
  const retired = await request(`/api/v1/admin/teaching-assets/versions/${v2.id}/retire`, { method: 'POST', token: adminToken });
  assert(retired.item.status === 'retired' && retired.item.versions[0].status === 'retired', 'Final published version was not retired.');
  await request(`/api/v1/agent/teaching-assets/math.${marker}?language=zh-CN`, { token: studentToken, expected: [404] });
  const audits = await prisma.adminAuditLog.findMany({ where: { module: 'teaching-assets', resourceId: { in: [assetId, ...versionIds] } } });
  assert(audits.some((event) => event.action === 'create_draft') && audits.some((event) => event.action === 'publish') && audits.some((event) => event.action === 'retire'), 'Required admin audit events are missing.');
  console.log(JSON.stringify({ verdict: 'pass', unauthorizedBlocked: true, invalidComponentBlocked: true, lifecycle: ['draft', 'review', 'approved', 'published', 'retired'], versionCutover: { v1AvailableDuringV2Draft: true, v1RetiredOnV2Publish: true, activeVersion: 2 }, effectiveness: { exposureContexts: 10, uniqueLearners: 1, completionRate: 1, firstTryCorrectRate: 1, independentVerificationPassRate: 1, stable: 1, signal: 'insufficient_data', automaticAction: false }, qualityWorkflow: ['open', 'acknowledged', 'resolved', 'open'], auditEvents: audits.length, answerKeyHidden: true }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(async () => {
  await prisma.teachingInteractionEvent.deleteMany({ where: { assetVersionId: { in: versionIds } } });
  if (assetId) await prisma.teachingAssetExposure.deleteMany({ where: { assetId } });
  await prisma.learningIntervention.deleteMany({ where: { decisionKey: `${marker}-effectiveness` } });
  if (assetId) await prisma.teachingAsset.deleteMany({ where: { id: assetId } });
  if (qualityAlertKey) await prisma.adminAuditLog.deleteMany({ where: { resourceType: 'teaching-asset-quality-alert', resourceId: qualityAlertKey } });
  await prisma.adminAuditLog.deleteMany({ where: { module: 'teaching-assets', resourceId: { in: [assetId, ...versionIds].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, studentEmail] } } });
  await prisma.$disconnect();
});
