import { expect, test, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const payload = {
  schemaVersion: '1', title: '看懂函数图像的水平平移', summary: '拖动 h，观察函数顶点如何移动。',
  instructions: ['先把 h 调到 0。', '再尝试正数和负数。'],
  component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
  activePrompt: { id: 'shift-check-v1', prompt: 'h=3 时顶点在哪里？', options: [{ id: 'left', label: '(-3,0)' }, { id: 'right', label: '(3,0)' }], correctAnswer: 'right', correctFeedback: '正确。', incorrectFeedback: '再观察。' },
  verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
};
const topic = { id: 11, code: 'M-FUNCTION-SHIFT', title: '函数平移', subject: 'math', syllabusVersion: '2026', status: 'published' };
function asset(status: 'approved' | 'published') {
  return {
    id: 'asset-1', stableKey: 'math.function-horizontal-shift', type: 'micro_lesson', subjectCode: 'math', status, updatedAt: '2026-09-17T00:00:00.000Z', _count: { exposures: 0 },
    topics: [{ topicId: topic.id, topic }],
    versions: [{ id: 'version-1', version: 1, status, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3, renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1', payloadSchemaVersion: 'function-horizontal-shift-v1', payload, fallbackPayload: { title: payload.title, body: payload.summary }, sourceRefs: [{ type: 'syllabus_topic', id: '11', version: '2026' }], reviewState: 'approved', reviewedByUserId: 1, reviewedAt: '2026-09-17T00:00:00.000Z', publishedAt: status === 'published' ? '2026-09-17T00:01:00.000Z' : null, retiredAt: null, updatedAt: '2026-09-17T00:00:00.000Z' }]
  };
}
const emptyMetrics = { exposureContexts: 0, uniqueLearners: 0, completedContexts: 0, skippedContexts: 0, completionRate: null, sources: {}, activePrompt: { attempts: 0, firstAttempts: 0, firstTryCorrectRate: null, passedContexts: 0 }, independentVerification: { total: 0, conclusive: 0, passed: 0, failed: 0, inconclusive: 0, passRate: null, phases: [] }, stability: { stable: 0, notStable: 0, inconclusive: 0, pending: 0 }, operationalSignal: { policyVersion: '1', signal: 'insufficient_data', reasonCodes: [], automaticAction: false } };
const analytics = { schemaVersion: '1', asset: { id: 'asset-1', stableKey: 'math.function-horizontal-shift', subjectCode: 'math' }, window: { days: 30, since: '2026-08-18T00:00:00.000Z', generatedAt: '2026-09-17T00:00:00.000Z' }, aggregate: emptyMetrics, versions: [{ id: 'version-1', version: 1, language: 'zh-CN', status: 'approved', publishedAt: null, metrics: emptyMetrics }] };
const quality = { schemaVersion: '1', policyVersion: '1', windowDays: 30, summary: { total: 0, open: 0, acknowledged: 0, resolved: 0, review: 0, watch: 0, insufficientData: 0 }, items: [] };
const cohort = { deliveries: 0, completedDeliveries: 0, completionRate: null, independentVerifications: 0, conclusiveVerifications: 0, verificationPassRate: null, stabilityAssessments: 0, stableCount: 0, notStableCount: 0, stableRate: null };
const routing = { schemaVersion: '1', policyVersion: '1', currentMode: 'shadow', rollout: { subjects: [], percent: 0 }, window: { days: 30, since: '2026-08-18T00:00:00.000Z', generatedAt: '2026-09-17T00:00:00.000Z' }, gate: { qualified: false, minimumDecisions: 30, reasonCodes: ['insufficient_sample'], automaticActivation: false }, metrics: { decisions: 0, coverageRate: null, fallbackRate: null, divergenceRate: null, explorationRate: null, alternateAfterIneffectiveCount: 0, p95LatencyMs: null, modes: {} }, subjects: [], learningOutcomes: { schemaVersion: '1', observations: 0, policyVersion: '1', evidenceQualified: false, cohorts: { baseline: cohort, active: cohort }, comparison: { verificationPassRateDelta: null, stableRateDelta: null, completionRateDelta: null, consecutiveActiveImmediateFailures: 0 }, circuit: { status: 'monitoring', reasonCodes: [] }, circuitStates: {} }, recent: [] };

test('publishes an approved teaching asset through the isolated authoring entry', async ({ page }) => {
  let published = false;
  await page.addInitScript(() => window.localStorage.setItem('cscalite.accessToken', 'authoring-admin-token'));
  await page.route('**/api/v1/auth/me**', (route) => json(route, { id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin', emailVerifiedAt: '2026-09-01T00:00:00.000Z' }));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/quality-alerts', (route) => json(route, quality));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/routing-diagnostics', (route) => json(route, routing));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/asset-1/analytics', (route) => json(route, analytics));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/asset-1', (route) => json(route, { schemaVersion: '1', item: asset(published ? 'published' : 'approved') }));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/versions/version-1/publish', (route) => { published = true; return json(route, { schemaVersion: '1', item: asset('published') }); });
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets', (route) => json(route, { schemaVersion: '1', items: [asset(published ? 'published' : 'approved')], topics: [topic], componentKeys: ['math.function-horizontal-shift'] }));

  await page.goto('/authoring.html?workspace=teaching-assets');
  await expect(page.getByText('Moodlelike Authoring')).toBeVisible();
  await expect(page.getByRole('button', { name: '发布上线' })).toBeVisible();
  await page.getByRole('button', { name: '发布上线' }).click();
  await expect.poll(() => published).toBe(true);
  await expect(page.getByRole('button', { name: '创建新版本' })).toBeVisible();
});
