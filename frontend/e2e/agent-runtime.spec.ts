import { expect, test, type Page, type Route } from '@playwright/test';

const conversationId = 'conversation-1';
const runId = 'run-1';
const artifactId = 'artifact-1';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const artifact = {
  id: artifactId,
  conversationId,
  runId,
  type: 'learning_plan',
  version: 1,
  status: 'ready',
  title: '今日数学优先任务',
  summary: '先完成一次短诊断，再根据结果调整训练。',
  domainEntityType: 'adaptive_subject',
  domainEntityId: 'math',
  route: '/agent',
  snapshot: {
    task: { type: 'diagnostic', subject: 'math', questionCount: 8 },
    estimatedMinutes: 18,
    confidence: 'high',
    canStart: true,
    route: '/agent'
  },
  createdAt: '2026-09-13T08:01:00.000Z'
};

const conversation = {
  id: conversationId,
  status: 'active',
  title: '今天的数学安排',
  lastMessageAt: '2026-09-13T08:01:00.000Z',
  createdAt: '2026-09-13T08:00:00.000Z',
  updatedAt: '2026-09-13T08:01:00.000Z',
  messages: [
    { id: 'message-1', conversationId, role: 'user', content: { schemaVersion: '1', text: '我今天该学什么？' }, clientMessageId: 'client-1', runId, createdAt: '2026-09-13T08:00:00.000Z' },
    { id: 'message-2', conversationId, role: 'assistant', content: { schemaVersion: '1', text: '先完成数学短诊断，系统会用真实作答结果决定下一步。', artifactIds: [artifactId] }, clientMessageId: null, runId, createdAt: '2026-09-13T08:01:00.000Z' }
  ],
  artifacts: [artifact]
};

const attachmentList = {
  items: [],
  limits: { maxFilesPerMessage: 5, maxFileBytes: 20 * 1024 * 1024, maxMessageBytes: 40 * 1024 * 1024 }
};

const journeyState = {
  schemaVersion: '1', generatedAt: '2026-09-16T08:00:00.000Z', activeWorkspace: null,
  plans: [artifact],
  stages: [{
    id: 'practice:artifact-1', kind: 'practice', conversationId, journeyId: artifactId,
    title: '数学短诊断', subject: 'math', taskType: 'diagnostic', status: 'completed',
    startedAt: '2026-09-13T08:00:00.000Z', updatedAt: '2026-09-13T08:20:00.000Z', completedAt: '2026-09-13T08:20:00.000Z',
    metrics: { batchCount: 1, completedBatchCount: 1, allocatedQuestionCount: 5, answeredQuestionCount: 5, correctCount: 4, accuracy: 80, assistanceCount: 1, teachingCount: 0 },
    resume: null, provenance: { source: 'agent_artifacts', artifactIds: [artifactId], domainEntityRefs: [{ type: 'csca_adaptive_round', id: '81' }] }
  }]
};

async function mockAgentWorkspace(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', 'agent-ui-token');
  });
  await page.route('**/api/v1/auth/me**', (route) => json(route, {
    id: '42', email: 'student@example.com', role: 'student', displayName: '林澈', emailVerifiedAt: '2026-09-01T00:00:00.000Z'
  }));
  await page.route('**/api/v1/me/student-profile', (route) => json(route, {
    nationality: null, nationalityCode: null, country: '中国', countryCode: 'CN', grade: '高三', gradeCode: '12',
    genderCode: null, educationStageCode: 'high_school', graduationYear: 2027, targetExamDate: '2027-06-01',
    targetSubjectCodes: ['math', 'physics', 'chemistry'], preferredQuestionLanguageCode: 'zh', examAttemptType: 'first_attempt',
    weeklyGoalDays: 5, targetMajorCategoryCode: null, onboardingCompletedAt: '2026-09-01T00:00:00.000Z',
    onboardingSkippedAt: null, currentOrganizationId: null, updatedAt: '2026-09-15T00:00:00.000Z'
  }));
  await page.route('**/api/v1/me/agent-learning-settings', (route) => json(route, {
    currentScoringPolicyVersion: 'csca-score-unverified-v1',
    scoreGoal: {
      status: 'configured',
      goal: {
        goalId: 'goal-1', examDate: '2027-06-01', examBatchCode: 'csca-2027-06', goalVersion: 'goal-v1',
        scoringPolicyVersion: 'csca-score-unverified-v1', subjects: [{ subject: 'math', targetScore: 85, priority: 1 }]
      }
    },
    studyAvailability: {
      availabilityVersion: 'availability-v1', timezone: 'Asia/Shanghai', weeklyMinutesGoal: 300,
      preferredStudyDays: [1, 3, 5], defaultSessionMinutes: 30, source: 'user', effectiveAt: '2026-09-15T00:00:00.000Z'
    },
    learningPreference: {
      preferenceVersion: '1', defaultLearningMode: 'recommended', defaultFreePracticeSubject: 'math',
      defaultFreePracticeCount: 5, source: 'user', updatedAt: '2026-09-15T00:00:00.000Z'
    }
  }));
  await page.route('**/api/v1/me/agent-learning-preference', async (route) => {
    const body = await route.request().postDataJSON();
    return json(route, {
      preferenceVersion: '2', defaultLearningMode: body.defaultLearningMode,
      defaultFreePracticeSubject: body.defaultFreePracticeSubject, defaultFreePracticeCount: body.defaultFreePracticeCount,
      source: 'user', updatedAt: '2026-09-16T00:00:00.000Z'
    });
  });
  await page.route('**/api/v1/agent/**', (route) => json(route, { item: null, items: [] }));
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, journeyState));
  await page.route(/\/api\/v1\/agent\/conversations(?:\?.*)?$/, (route) => json(route, [conversation]));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, conversation));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/attachments(?:\\?.*)?$`), (route) => json(route, attachmentList));
  await page.route(new RegExp(`/api/v1/agent/runs/${runId}(?:\\?.*)?$`), (route) => json(route, {
    id: runId, conversationId, userId: 42, status: 'completed', channel: 'web', traceId: 'trace-1',
    startedAt: '2026-09-13T08:00:00.000Z', completedAt: '2026-09-13T08:01:00.000Z', errorCode: null, errorRetryable: null,
    artifacts: [artifact], toolCalls: []
  }));
}

test('rejects locale-prefixed Agent routes instead of preserving a legacy alias', async ({ page }) => {
  await page.goto('/zh/agent');
  await expect(page).toHaveURL(/\/zh\/agent$/);
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await expect(page.locator('.agent-workspace')).toHaveCount(0);
});

test('applies language preference without putting the locale in the route', async ({ page }) => {
  await page.goto('/agent?lang=en');
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('renders an evidence-based learning workspace without horizontal overflow', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.goto('/agent');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '今天从这一项开始' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeEnabled();
  await expect(page.locator('.agent-workspace')).toHaveClass(/is-single-workbench/);
  await expect(page.locator('.agent-message-list.is-activity-stream')).toHaveCount(0);
  if (testInfo.project.name !== 'mobile') {
    await expect(page.getByRole('heading', { name: '今天从这一项开始' })).toBeVisible();
  }
  await expect(page.locator('.agent-learning-mode')).toHaveCount(0);
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByText('你的目标与考试日期')).toBeVisible();
    await expect(page.locator('.agent-account-card')).toContainText('林澈');
    await expect(page.locator('.agent-account-card')).toContainText('个人设置');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  const workspace = await page.locator('.agent-workspace').boundingBox();
  const viewport = page.viewportSize();
  expect(workspace?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  expect((workspace?.y ?? 0) + (workspace?.height ?? 0)).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
  if (process.env.AGENT_UI_CAPTURE_DIR) {
    await page.screenshot({
      path: `${process.env.AGENT_UI_CAPTURE_DIR}/agent-workspace-${testInfo.project.name}.png`,
      fullPage: true
    });
  }
});

test('keeps the Agent workbench usable when the journey read model is temporarily unavailable', async ({ page }) => {
  await mockAgentWorkspace(page);
  let journeyStateAttempts = 0;
  await page.route('**/api/v1/agent/journey/state', (route) => {
    if (journeyStateAttempts++ === 0) {
      return route.abort('connectionrefused');
    }
    return json(route, journeyState);
  });

  await page.goto('/agent');
  await expect(page.getByRole('heading', { name: '今天从这一项开始' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('学习服务暂时未连接，恢复后会自动继续。')).toHaveCount(0);
  expect(journeyStateAttempts).toBe(1);
});

test('does not render internal Agent messages as a primary activity stream', async ({ page }) => {
  await mockAgentWorkspace(page);
  const longConversation = {
    ...conversation,
    updatedAt: '2026-09-13T09:00:00.000Z',
    messages: Array.from({ length: 24 }, (_, index) => ({
      id: `anchored-message-${index + 1}`,
      conversationId,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: { schemaVersion: '1', text: `第 ${index + 1} 条学习消息：用于确认长会话恢复后始终展示最新内容。` },
      clientMessageId: index % 2 === 0 ? `anchored-client-${index + 1}` : null,
      runId: null,
      createdAt: `2026-09-13T08:${String(index).padStart(2, '0')}:00.000Z`
    }))
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, longConversation));

  await page.goto('/agent');
  await expect(page.getByText('第 24 条学习消息：用于确认长会话恢复后始终展示最新内容。')).toHaveCount(0);
  await expect(page.locator('.agent-workspace')).toHaveClass(/is-single-workbench/);
  await expect(page.getByRole('heading', { name: '今天从这一项开始' })).toBeVisible();
  await expect(page.locator('.agent-message-list.is-activity-stream')).toHaveCount(0);
});

test('keeps the workbench and standalone subject Q&A usable on each viewport', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.goto('/agent');
  for (const locator of [
    page.getByRole('button', { name: '做题', exact: true }),
    page.getByRole('button', { name: '开始学习', exact: true })
  ]) {
    const box = await locator.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
  }
  await expect(page.locator('.agent-workspace')).toHaveClass(/is-single-workbench/);
  await expect(page.locator('.agent-composer')).toHaveCount(0);
  await page.getByRole('button', { name: '学科问答', exact: true }).click();
  const questionInput = page.getByLabel('询问数学、物理或化学');
  await expect(questionInput).toBeVisible();
  await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();
  await expect(page.getByText('仅支持文字提问；自由问答不会改变掌握度。')).toBeVisible();
  await expect(page.getByRole('button', { name: '新建学习对话' })).toHaveCount(0);
  const composer = await page.locator('.agent-composer').boundingBox();
  const viewport = page.viewportSize();
  expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
});

test('keeps subject Q&A separate from the learning workspace and preserves its boundary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the subject Q&A request contract.');
  await mockAgentWorkspace(page);
  let submitted = false;
  let submittedBody: Record<string, unknown> | null = null;
  const qaConversation = {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: 'qa-user-1', conversationId, role: 'user', runId, clientMessageId: 'qa-client-1', createdAt: '2026-09-13T09:00:00.000Z',
        content: { schemaVersion: '1', surface: 'subject_qa', text: '为什么加速度可以是负数？' }
      },
      {
        id: 'qa-assistant-1', conversationId, role: 'assistant', runId, clientMessageId: null, createdAt: '2026-09-13T09:00:01.000Z',
        content: {
          schemaVersion: '1', surface: 'subject_qa', text: '负号表示加速度方向与选定的正方向相反，并不表示加速度大小小于零。',
          subjectQa: { decision: 'answer', subject: 'physics', generatedByAI: true, masteryChanged: false }
        }
      }
    ]
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/messages(?:\\?.*)?$`), async (route) => {
    submittedBody = await route.request().postDataJSON();
    submitted = true;
    return json(route, { messageId: 'qa-user-1', runId, status: 'queued', eventsUrl: `/api/v1/agent/runs/${runId}/events` });
  });
  await page.route(new RegExp(`/api/v1/agent/runs/${runId}/events(?:\\?.*)?$`), (route) => {
    const event = { eventId: 'qa-event-1', runId, conversationId, sequence: 1, type: 'run.completed', createdAt: '2026-09-13T09:00:01.000Z', data: {} };
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `id: 1\ndata: ${JSON.stringify(event)}\n\n` });
  });
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, submitted ? qaConversation : conversation));

  await page.goto('/agent');
  await expect(page.locator('.agent-composer')).toHaveCount(0);
  await page.getByRole('button', { name: '学科问答', exact: true }).click();
  await expect(page.getByRole('heading', { name: '有学科问题，直接问。' })).toBeVisible();
  await page.getByLabel('询问数学、物理或化学').fill('为什么加速度可以是负数？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText('负号表示加速度方向与选定的正方向相反，并不表示加速度大小小于零。')).toBeVisible();
  expect(submittedBody).toMatchObject({ surface: 'subject_qa', text: '为什么加速度可以是负数？' });
  expect(submittedBody).not.toHaveProperty('pageContext');
  expect(submittedBody).toMatchObject({ attachmentIds: [] });
  await expect(page.getByText('自由问答，不改变掌握度')).toBeVisible();

  await page.getByRole('button', { name: '做题', exact: true }).click();
  await expect(page.locator('.agent-workspace')).toHaveClass(/is-single-workbench/);
  await expect(page.locator('.agent-composer')).toHaveCount(0);
  await page.getByRole('button', { name: '学科问答', exact: true }).click();
  await expect(page.getByText('负号表示加速度方向与选定的正方向相反，并不表示加速度大小小于零。')).toBeVisible();
});

test('falls back to a temporary free-practice entry when the recommended task lacks supply', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the supply fallback contract.');
  await mockAgentWorkspace(page);
  const shortageArtifact = {
    ...artifact,
    snapshot: { ...artifact.snapshot, canStart: false },
    route: null
  };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, { ...journeyState, plans: [shortageArtifact] }));
  await page.goto('/agent');
  const fallback = page.getByRole('button', { name: /改做自由练习/ });
  await expect(fallback).toBeEnabled();
  await fallback.click();
  await expect(page.getByRole('heading', { name: '你决定现在练什么、练多少' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始自由练习' })).toBeEnabled();
  await expect(page.getByText('只调整本次学习，不会修改你在学习设置中的默认模式。')).toBeVisible();
});

test('offers an explicit resume entry for an active verification without a saved browser URL', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for cross-device workspace recovery.');
  await mockAgentWorkspace(page);
  const activeWorkspace = {
    kind: 'adaptive_round', conversationId, verificationId: 'verification-1', roundId: 81,
    phase: 'practice', taskType: 'intervention_verification', subject: 'math'
  };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, {
    ...journeyState,
    activeWorkspace,
    stages: journeyState.stages.map((stage) => ({ ...stage, status: 'active', completedAt: null, resume: activeWorkspace }))
  }));
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));
  await page.goto('/agent');
  await expect(page.getByRole('button', { name: '继续上次做题', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/agentRoundId=/);
  await page.getByRole('button', { name: '继续上次做题', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/agent\\?.*agentRoundId=81'));
  await expect(page).toHaveURL(new RegExp('agentInterventionVerificationId=verification-1'));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByText('阶段验证 · 数学')).toBeVisible();
  await expect(page.getByLabel('当前学习辅助')).toBeHidden();
});

test('stops polling and exits an unavailable restored round', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the stale round recovery contract.');
  await mockAgentWorkspace(page);
  let roundRequests = 0;
  let entitlementRequests = 0;
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/107', (route) => {
    roundRequests += 1;
    return json(route, { statusCode: 404, message: '自适应训练轮次不存在。' }, 404);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => {
    entitlementRequests += 1;
    return json(route, { enabled: true, balanceUnits: 50, unlimited: false });
  });
  await page.goto(`/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=107&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区')).toHaveCount(0);
  await expect(page).not.toHaveURL(/agentRoundId=107/);
  await page.waitForTimeout(800);
  expect(roundRequests).toBeLessThanOrEqual(2);
  expect(entitlementRequests).toBeLessThanOrEqual(2);
});

test('shows a continue-learning entry for an interrupted stage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the history resume contract.');
  await mockAgentWorkspace(page);
  const resumedConversationId = 'conversation-resume-1';
  const resume = {
    kind: 'adaptive_round', conversationId: resumedConversationId, artifactId, roundId: 81,
    phase: 'practice', taskType: 'diagnostic', subject: 'math'
  };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, {
    ...journeyState,
    activeWorkspace: resume,
    stages: journeyState.stages.map((stage) => ({ ...stage, status: 'active', completedAt: null, resume }))
  }));
  await page.route(new RegExp(`/api/v1/agent/conversations/${resumedConversationId}(?:\\?.*)?$`), async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return json(route, { ...conversation, id: resumedConversationId, messages: conversation.messages.map((message) => ({ ...message, conversationId: resumedConversationId })) });
  });
  const now = '2026-09-15T10:00:00.000Z';
  const resumedRound = {
    session: { id: 51, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 81, sessionId: 51, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: now, submittedAt: null, version: 1 },
    questions: [{ id: 101, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '恢复后应当直接看到这道函数题。', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], topicId: 67, topicCode: 'function', topicTitle: '函数', position: 1 }]
  };
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81**', (route) => json(route, resumedRound));
  await page.goto(`/agent?conversation=${conversationId}`);
  const continueLearning = page.getByRole('button', { name: '继续上次做题', exact: true });
  await expect(continueLearning).toBeVisible();
  await expect(page.getByRole('heading', { name: '继续上次做到的题目' })).toBeVisible();
  await expect(page.getByText('完成后建议')).toBeVisible();
  await expect(page.getByText('当前推荐任务')).toHaveCount(0);
  await expect(page.getByText('保留原科目、题目位置和作答状态。').first()).toBeVisible();
  await continueLearning.click();
  await expect(page).toHaveURL(new RegExp(`agentContextId=${resumedConversationId}.*agentRoundId=81`), { timeout: 500 });
  await expect(page).not.toHaveURL(/[?&](?:conversation|agentConversationId)=/);
  await expect(page).toHaveURL(new RegExp('agentRoundId=81'));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('恢复后应当直接看到这道函数题。');
  await expect(page.getByLabel('当前学习辅助')).toBeHidden();
});

test('does not present a submitted report as an interrupted learning task', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the lifecycle state contract.');
  await mockAgentWorkspace(page);
  const reportWorkspace = {
    kind: 'adaptive_round', conversationId, artifactId, roundId: 81,
    phase: 'report', taskType: 'diagnostic', subject: 'math'
  };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, {
    ...journeyState,
    activeWorkspace: reportWorkspace,
    stages: journeyState.stages.map((stage) => ({ ...stage, status: 'report_ready', resume: reportWorkspace }))
  }));
  await page.goto(`/agent?conversation=${conversationId}`);
  await expect(page.getByRole('button', { name: '继续上次做题', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/agentRoundId=/);
});

test('starts student-initiated free practice without turning it into a recommended plan', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.addInitScript(() => window.localStorage.setItem('moodlelike.agent.learningMode', 'free'));
  let conversationAttachmentAnalysisLoads = 0;
  page.on('request', (request) => {
    if (/\/api\/v1\/agent\/conversations\/[^/]+\/attachment-analyses/.test(request.url())) conversationAttachmentAnalysisLoads += 1;
  });
  let requestBody: Record<string, unknown> | null = null;
  let freeStarted = false;
  let startAttempts = 0;
  const freeArtifact = {
    ...artifact,
    id: 'free-task-1',
    type: 'learning_task',
    title: '物理自由练习',
    snapshot: {
      source: 'student_initiated',
      task: { type: 'free_practice', subject: 'physics', questionCount: 3 },
      sessionId: 31,
      roundId: 41
    }
  };
  const freeConversation = {
    ...conversation,
    messages: [...conversation.messages, {
      id: 'message-free-task-1', conversationId, role: 'assistant', clientMessageId: null, runId: null,
      createdAt: '2026-09-15T08:35:00.000Z',
      content: { schemaVersion: '1', text: '已开始物理自由练习。', artifactIds: [freeArtifact.id] }
    }],
    artifacts: [artifact, freeArtifact]
  };
  const freeRoundDetail = {
    session: { id: 31, userId: 42, subject: 'physics', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: '2026-09-15T08:35:00.000Z', completedAt: null, createdAt: '2026-09-15T08:35:00.000Z', updatedAt: '2026-09-15T08:35:00.000Z' },
    round: { id: 41, sessionId: 31, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'practice' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: '2026-09-15T08:35:00.000Z', submittedAt: null, version: 1 },
    questions: [{ id: 401, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '速度由 2 m/s 增加到 5 m/s，速度变化量是多少？', options: [{ id: 'A', text: '2 m/s' }, { id: 'B', text: '3 m/s' }], topicId: 47, topicCode: 'motion', topicTitle: '运动学', position: 1 }]
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, {
    ...(freeStarted ? freeConversation : conversation)
  }));
  await page.route('**/api/v1/agent/free-practice/start', async (route) => {
    startAttempts += 1;
    requestBody = await route.request().postDataJSON();
    if (startAttempts === 1) return json(route, { message: 'temporary free-practice outage' }, 503);
    freeStarted = true;
    return json(route, {
      schemaVersion: '1', artifactId: 'free-task-1', conversationId,
      sessionId: 31, roundId: 41, mode: 'practice', questionCount: 3,
      subject: 'physics', questionLanguage: 'zh', toolName: 'start_student_initiated_practice', taskType: 'free_practice',
      route: '/agent', legacyRoute: '/csca-subjects/physics/practice/rounds/41',
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: 'physics', reasonCodes: ['student_initiated'], objective: null }
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/41**', (route) => {
    if (route.request().method() === 'PATCH') return json(route, freeRoundDetail.round);
    return json(route, freeRoundDetail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/41/check', (route) => json(route, {
    questionId: 401, selected: 'A', correctAnswer: 'B', isCorrect: false,
    explanation: '速度变化量等于末速度减初速度。', knowledgeTags: ['运动学']
  }));
  await page.goto('/agent');
  await expect(page.getByRole('heading', { name: '你决定现在练什么、练多少' })).toBeVisible();
  const subjectChoices = page.getByRole('radiogroup', { name: '选择科目' });
  const countChoices = page.getByRole('radiogroup', { name: '本批题量' });
  await expect(subjectChoices.getByRole('radio', { name: '数学', exact: true })).toHaveAttribute('aria-checked', 'true');
  await subjectChoices.getByRole('radio', { name: '物理', exact: true }).click();
  await countChoices.getByRole('radio', { name: '3 题', exact: true }).click();
  await expect(subjectChoices.getByRole('radio', { name: '物理', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(countChoices.getByRole('radio', { name: '3 题', exact: true })).toHaveAttribute('aria-checked', 'true');
  const startFreePractice = page.getByRole('button', { name: '开始自由练习', exact: true });
  if (testInfo.project.name === 'mobile') {
    await expect.poll(async () => (await subjectChoices.getByRole('radio', { name: '物理', exact: true }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await startFreePractice.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await startFreePractice.click();
  await expect(page.getByRole('alert')).toContainText('自由练习还没有开始；科目和题量已保留。');
  await page.getByRole('button', { name: '重试开始' }).click();
  await expect.poll(() => requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({ subject: 'physics', questionCount: 3, questionLanguage: 'zh' });
  expect(requestBody).not.toHaveProperty('conversationId');
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page).toHaveURL(/agentContextId=conversation-1/);
  await expect(page).not.toHaveURL(/[?&](?:conversation|agentConversationId)=/);
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('自由练习 · 物理');
  await expect(page.getByLabel('自由练习任务')).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('速度由 2 m/s 增加到 5 m/s');
  expect(conversationAttachmentAnalysisLoads).toBe(0);
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: '学习设置', exact: true }).click();
    await page.getByRole('button', { name: '学习方式', exact: true }).click();
    await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /智能推荐/ }).click();
    await page.getByRole('button', { name: '做题', exact: true }).click();
    await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('速度由 2 m/s 增加到 5 m/s');
    await page.getByRole('button', { name: '学习设置', exact: true }).click();
    await page.getByRole('button', { name: '学习方式', exact: true }).click();
    await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /自由练习/ }).click();
    await page.getByRole('button', { name: '做题', exact: true }).click();
    await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('速度由 2 m/s 增加到 5 m/s');
    await page.getByLabel('Agent 学习任务工作区').getByRole('button', { name: 'A 2 m/s', exact: true }).click();
    await expect(page.getByLabel('Agent 学习任务工作区').locator('.special-answer-result')).toContainText('正确答案是 B');
  }
  expect(startAttempts).toBe(2);
});

test('loads conversations only after entering subject Q&A', async ({ page }) => {
  await mockAgentWorkspace(page);
  let conversationDetailLoads = 0;
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => {
    conversationDetailLoads += 1;
    return json(route, conversation);
  });
  await page.goto('/agent');
  expect(conversationDetailLoads).toBe(0);
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await page.getByRole('button', { name: '目标进度', exact: true }).click();
  await expect(page.getByRole('heading', { name: '离考试目标还有多远' })).toBeVisible();
  expect(conversationDetailLoads).toBe(0);
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.journeySection'))).toBe('settings');
  await page.getByRole('button', { name: '学科问答', exact: true }).click();
  await expect.poll(() => conversationDetailLoads).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.journeySection'))).toBe('qa');
});

test('separates learning settings from account settings and restores the selected settings section', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.goto('/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await expect(page.getByLabel('当前学习上下文')).toBeVisible();
  await expect(page.locator('.agent-settings-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: '围绕目标，只保留一个明确的下一步' })).toBeVisible();
  await page.getByRole('button', { name: '学习方式', exact: true }).click();
  await expect(page.getByLabel('当前学习上下文')).toContainText('讲解、动画和结果按当前学习状态呈现，学科问答独立保留');
  await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /自由练习/ }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.learningMode'))).toBe('free');
  await page.getByRole('button', { name: '学习画像', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学习画像' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.journeySection'))).toBe('settings');

  await page.reload();
  await expect(page.getByRole('heading', { name: '学习画像' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '做题', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.agent-composer')).toHaveCount(0);
  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/me\?section=settings$/);
  await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();
  await expect(page.locator('.standalone-account-card.profile')).toContainText('林澈');
});

test('reviews a concrete mistake and launches an independently verified targeted round', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  const startBodies: Record<string, unknown>[] = [];
  let reviewCompleteBody: Record<string, unknown> | null = null;
  let wrongQuestionLoads = 0;
  const overview = {
    schemaVersion: '1', generatedAt: '2026-09-16T08:00:00.000Z',
    goal: { examDate: '2027-06-01', weeklyGoalDays: 5, totalTargetScore: 255, subjects: [{ subject: 'chemistry', targetScore: 85 }] },
    progress: { subjects: [{ subject: 'physics', totalTopicCount: 10, evidencedTopicCount: 4, strongTopicCount: 1, developingTopicCount: 2, needsAttentionTopicCount: 1, insufficientEvidenceTopicCount: 6, answerEvidenceCount: 12 }] },
    weaknesses: {
      stateSource: 'user_csca_topic_mastery_v1',
      subjects: [{ subject: 'physics', evidenceCount: 5, topics: [{ topicId: 47, code: 'mechanics-inertia', title: '惯性', score: .32, confidence: .8, status: 'needs_attention', attemptCount: 5, correctCount: 2, lastPracticedAt: '2026-09-15T08:00:00.000Z', updatedAt: '2026-09-15T08:00:00.000Z' }] }],
      reviewQueue: [
        { reviewItemId: '71', patternType: 'concept_confusion', topicId: 47, subject: 'physics', title: '惯性判断', dueAt: '2026-09-16T08:00:00.000Z', priority: 3, recurrenceCount: 3, status: 'improving', consecutiveVerificationPassCount: 1, requiredConsecutiveVerificationPassCount: 2, lastVerificationPassedAt: '2026-09-15T08:00:00.000Z', href: '/review/71' },
        { reviewItemId: '72', patternType: 'pacing', topicId: 47, subject: 'physics', title: '惯性判断', dueAt: '2026-09-17T08:00:00.000Z', priority: 1, recurrenceCount: 1, status: 'active', consecutiveVerificationPassCount: 0, requiredConsecutiveVerificationPassCount: 2, lastVerificationPassedAt: null, href: '/review/72' }
      ]
    },
    resources: { source: 'published_past_papers', subjectScope: ['physics'], items: [] }
  };
  const wrongQuestions = {
    summary: { total: 1, unreviewed: 1, dueForReview: 1, patternTypes: [{ patternType: 'concept_confusion', label: '概念混淆', count: 1 }] },
    reviewPacks: [],
    items: [{
      itemKey: 'adaptive_round:51:401', sourceType: 'adaptive_round', sourceId: 51, questionId: 401,
      subject: 'physics', topicId: 47, topicTitle: '惯性', topic: { id: 47, slug: 'inertia', title: '惯性', subject: 'physics', module: '力与运动' },
      prompt: '汽车急刹车时乘客向前倾，主要体现了物体的（ ）',
      options: [{ id: 'A', text: '弹性' }, { id: 'B', text: '惯性' }, { id: 'C', text: '重力' }, { id: 'D', text: '摩擦力' }],
      selected: 'D', selectedAnswer: 'D', correctAnswer: 'B', explanation: '乘客身体保持原运动状态，这是惯性。', aiExplanationId: 901,
      structuredExplanation: { whyWrong: '把造成减速的摩擦力误当成身体继续向前运动的原因。', correctApproach: '先判断研究对象是否在保持原来的运动状态。', quickMethod: '状态来不及改变时优先考虑惯性。', avoidNextTime: '区分“改变运动的力”和“保持原状态的惯性”。' },
      mistakePattern: { patternType: 'concept_confusion', label: '概念混淆', confidence: .92, source: 'wrong_pattern' }, patternType: 'concept_confusion', patternLabel: '概念混淆', patternConfidence: .92,
      status: 'unreviewed', knowledgeTags: ['惯性'], timeSpentSeconds: 18, lastWrongAt: '2026-09-15T08:00:00.000Z', nextReviewAt: '2026-09-16T08:00:00.000Z', completedAt: '2026-09-15T08:00:00.000Z', reviewPath: null, practicePath: '/practice',
      reviewPattern: { id: 71, status: 'active', patternType: 'concept_confusion', nextReviewAt: '2026-09-16T08:00:00.000Z', lastReviewCompletedAt: null, verificationStatus: 'not_started', verificationRequired: true, verificationHref: '/verify/71' }
    }]
  };
  const roundDetail = {
    session: { id: 61, userId: 42, subject: 'physics', mode: 'practice', status: 'active', questionLanguage: 'zh', startedAt: '2026-09-16T08:10:00.000Z', completedAt: null, createdAt: '2026-09-16T08:10:00.000Z', updatedAt: '2026-09-16T08:10:00.000Z' },
    round: { id: 91, sessionId: 61, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'verification', focus: { reviewItemId: 71, topicId: 47, patternType: 'concept_confusion' } }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 3, startedAt: '2026-09-16T08:10:00.000Z', submittedAt: null, version: 1 },
    questions: [{ id: 501, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '公交车启动时乘客向后仰，说明物体具有（ ）', options: [{ id: 'A', text: '惯性' }, { id: 'B', text: '弹性' }], topicId: 47, topicCode: 'mechanics-inertia', topicTitle: '惯性', position: 1 }]
  };
  await page.route('**/api/v1/agent/journey/overview**', (route) => json(route, overview));
  await page.route((url) => url.pathname === '/api/v1/me/csca/wrong-questions', (route) => {
    wrongQuestionLoads += 1;
    return wrongQuestionLoads === 1
      ? json(route, { message: '错题证据暂时无法读取。' }, 503)
      : json(route, wrongQuestions);
  });
  await page.route((url) => url.pathname === '/api/v1/me/csca/wrong-questions/review-complete', async (route) => {
    reviewCompleteBody = await route.request().postDataJSON();
    return json(route, {
      id: 71, status: 'improving', nextReviewAt: '2026-09-23T08:00:00.000Z', reviewCount: 1,
      lastReviewCompletedAt: '2026-09-16T08:09:00.000Z', verificationStatus: 'pending_verification',
      verificationRequired: true, verificationHref: '/verify/71'
    });
  });
  await page.route('**/api/v1/agent/free-practice/start', async (route) => {
    startBodies.push(await route.request().postDataJSON());
    if (startBodies.length === 1) return json(route, { code: 'INTERVENTION_VERIFICATION_SUPPLY_UNAVAILABLE', message: '独立验证题库不足。' }, 409);
    return json(route, {
      schemaVersion: '1', artifactId: 'review-task-1', conversationId: 'review-context-1', sessionId: 61, roundId: 91,
      mode: 'practice', questionCount: 3, subject: 'physics', questionLanguage: 'zh', toolName: 'start_student_initiated_practice', taskType: 'free_practice',
      route: '/agent?agentContextId=review-context-1&agentArtifactId=review-task-1&agentRoundId=91&agentView=practice&agentTaskType=free_practice&agentSubject=physics', legacyRoute: '/legacy', journeyId: 'review-journey-1', batchIndex: 1,
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: 'physics', reasonCodes: ['student_initiated', 'review_due_pattern'], objective: '修复重复错因并完成验证' }
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/91**', (route) => json(route, roundDetail));

  await page.goto('/agent');
  await page.getByRole('button', { name: '错题与薄弱点', exact: true }).click();
  await page.getByRole('button', { name: '重试读取错题', exact: true }).click();
  await expect.poll(() => wrongQuestionLoads).toBe(2);
  await expect(page.locator('.agent-review-queue > button')).toHaveCount(1);
  await expect(page.getByText('独立验证 1/2 · 3 次重复错误', { exact: true })).toBeVisible();
  await expect(page.getByLabel('具体错题证据')).toContainText('汽车急刹车时乘客向前倾');
  await expect(page.getByLabel('具体错题证据')).toContainText('你的答案 D. 摩擦力');
  await expect(page.getByRole('button', { name: '已复盘，开始独立验证', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '查看解析并学习', exact: true }).click();
  await expect(page.getByLabel('具体错题证据')).toContainText('把造成减速的摩擦力误当成身体继续向前运动的原因');
  await expect(page.getByLabel('具体错题证据')).toContainText('区分“改变运动的力”和“保持原状态的惯性”');
  await expect(page.getByLabel('具体错题证据')).toContainText('先完成错因复盘，再独立完成 3 道同知识点新题');
  await page.getByRole('button', { name: '已复盘，开始独立验证', exact: true }).click();
  await expect.poll(() => reviewCompleteBody).not.toBeNull();
  expect(reviewCompleteBody).toMatchObject({ subject: 'physics', topicId: 47, patternType: 'concept_confusion', questionId: 401, sourceType: 'adaptive_round' });
  await expect.poll(() => startBodies.length).toBe(1);
  expect(startBodies[0]).toMatchObject({ subject: 'physics', questionCount: 3, focusTopicId: 47, reviewItemId: 71, patternType: 'concept_confusion' });
  expect(startBodies[0]).not.toHaveProperty('conversationId');
  await expect(page.getByLabel('具体错题证据').getByRole('alert')).toContainText('复盘记录已保存');
  await page.getByRole('button', { name: '已复盘，开始独立验证', exact: true }).click();
  await expect.poll(() => startBodies.length).toBe(2);
  expect(startBodies[1]).toMatchObject({ subject: 'physics', questionCount: 3, focusTopicId: 47, reviewItemId: 71, patternType: 'concept_confusion' });
  await expect(page).toHaveURL(/agentContextId=review-context-1/);
  await expect(page).not.toHaveURL(/[?&](?:conversation|agentConversationId)=/);
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('公交车启动时乘客向后仰');
  await page.reload();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('公交车启动时乘客向后仰');
});

test('restores a verification report and shows the durable learning verdict', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  let settleAttempts = 0;
  const now = '2026-09-23T08:00:00.000Z';
  const verificationArtifact = {
    ...artifact, id: 'verification-task-1', type: 'learning_task', status: 'completed',
    domainEntityType: 'csca_adaptive_round', domainEntityId: '191',
    snapshot: { schemaVersion: '1', source: 'student_initiated', task: { type: 'free_practice', subject: 'physics', questionCount: 3 }, roundId: 191 }
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, { ...conversation, artifacts: [...conversation.artifacts, verificationArtifact] }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/191/report**', (route) => json(route, {
    session: { id: 161, userId: 42, subject: 'physics', mode: 'practice', status: 'completed', questionLanguage: 'zh', startedAt: now, completedAt: now, createdAt: now, updatedAt: now },
    round: { id: 191, sessionId: 161, roundIndex: 1, status: 'submitted', plannerSnapshot: { mode: 'verification', focus: { reviewItemId: 71, topicId: 47, patternType: 'concept_confusion', topicTitle: '惯性' } }, answers: {}, timeSpent: {}, currentQuestion: 3, correctCount: 3, wrongCount: 0, unansweredCount: 0, startedAt: now, submittedAt: now, version: 2 },
    summary: { correctCount: 3, wrongCount: 0, unansweredCount: 0, total: 3, accuracy: 100, totalSeconds: 45 },
    weakTopics: [], diagnosticCoverage: null, nextRecommendation: 'try_challenge_round',
    learningDecision: {
      schemaVersion: '1', policyVersion: 'adaptive-mastery-decision-v1', generatedByAI: false, source: 'rules_and_learning_evidence', adaptationPending: false,
      status: 'needs_verification', headline: '本轮作答稳定，仍需间隔验证', explanation: '一次通过不代表已经稳定掌握。',
      evidenceBasis: { answeredCount: 3, firstAttemptCount: 3, independentCorrectCount: 3, assistedCorrectCount: 0, averageSeconds: 15, stateSource: 'learning_state_v2' },
      topics: [], nextStep: { type: 'delayed_verification', label: '等待间隔验证', reason: '需要跨时间再次独立作答。', subject: 'physics', topicId: 47, reviewItemId: 71, patternType: 'concept_confusion', dueAt: '2026-09-26T08:00:00.000Z', questionCount: 3 }
    },
    remediationPlan: { triggered: false, trigger: null, conceptCards: [], variantPractice: { availableCount: 0, questionIds: [] }, nextAction: 'continue' },
    trend: [],
    items: [1, 2, 3].map((id) => ({ id: 600 + id, orderNumber: id, position: id, difficulty: 'basic', questionType: 'single-choice', prompt: `惯性验证题 ${id}`, options: [{ id: 'A', text: '正确' }, { id: 'B', text: '错误' }], topicId: 47, topicCode: 'inertia', topicTitle: '惯性', selectedAnswer: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, explanation: '依据惯性判断。', knowledgeTags: ['惯性'], timeSpentSeconds: 15, mastery: .65 }))
  }));
  await page.route('**/api/v1/agent/practice-rounds/191/settle', (route) => {
    settleAttempts += 1;
    if (settleAttempts <= 2) return json(route, { message: '验证结论暂时无法同步。' }, 503);
    return json(route, {
      schemaVersion: '1', artifactId: 'verification-task-1', roundId: 191, decision: 'completed', verification: true,
      targetCorrectCount: 3, targetTotal: 3, targetAccuracy: 100,
      verificationResult: { verdict: 'needs_consolidation', currentRoundPassed: true, reviewItemId: 71, topicId: 47, patternType: 'concept_confusion', consecutivePassCount: 1, requiredPassCount: 2, nextReviewAt: '2026-09-26T08:00:00.000Z', nextAction: 'wait_for_spaced_verification' }
    });
  });

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=verification-task-1&agentRoundId=191&agentView=report&agentTaskType=free_practice&agentSubject=physics`);
  const result = page.locator('.agent-verification-result');
  await expect(result).toContainText('验证结论暂时无法同步');
  await result.getByRole('button', { name: '重试同步', exact: true }).click();
  await expect.poll(() => settleAttempts).toBe(3);
  await expect(result).toContainText('本轮通过，仍需间隔验证');
  await expect(result).toContainText('当前通过 1/2 次');
  await expect(result).not.toContainText('该薄弱点已修复');
  if (testInfo.project.name === 'desktop') {
    const reportRail = page.getByRole('complementary', { name: '本轮结果与下一步' });
    await expect(reportRail).toContainText('本轮通过，待间隔验证');
  } else {
    await expect(result).toContainText('下次验证：2026/9/26');
  }
  await page.getByLabel('本轮学习报告').getByRole('button', { name: '回到错题与薄弱点', exact: true }).click();
  await expect(page.getByRole('heading', { name: '先处理最影响下一步的薄弱点' })).toBeVisible();
  await expect(page).toHaveURL(/agentSection=weakness/);
});

test('keeps CSCALite organization and credit controls out of the independent account page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Independent account boundary coverage only needs one browser viewport.');
  await mockAgentWorkspace(page);
  let creditRequestCount = 0;
  await page.route('**/api/v1/me/ai-credits', (route) => {
    creditRequestCount += 1;
    return json(route, { balanceUnits: 50 });
  });

  await page.goto('/me?section=settings');
  await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();
  await expect(page.getByText('机构与 AI 额度', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '加入机构', exact: true })).toHaveCount(0);
  expect(creditRequestCount).toBe(0);
  await page.getByRole('button', { name: '返回 Agent 设置', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/agent\?agentSection=settings$/);
  await expect(page.getByRole('heading', { name: '设置 Agent 如何安排学习' })).toBeVisible();
});

test('recovers a failed past-paper workspace without leaving the Agent', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the recovery contract.');
  await mockAgentWorkspace(page);
  let detailRequests = 0;
  await page.route('**/api/v1/past-papers/retry-paper**', (route) => {
    detailRequests += 1;
    if (detailRequests === 1) return json(route, { message: '真题服务暂时不可用' }, 503);
    return json(route, {
      paper: {
        id: 99, slug: 'retry-paper', title: '恢复测试真题', category: 'past-paper', subject: 'math', examYear: 2026,
        language: 'zh', description: '恢复测试', questionCount: 1, pageCount: 1, hasAnswers: false, hasSolutions: false,
        isFree: true, isPublished: true, isFeatured: false, sortOrder: 1, downloadCount: 0, fileCount: 1,
        createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1
      },
      files: [{ id: 9901, kind: 'paper', label: '原卷 PDF', fileUrl: '/uploads/past-papers/retry-paper.pdf', mimeType: 'application/pdf', fileSizeBytes: 1024 }]
    });
  });
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/retry-paper/questions', (route) => json(route, {
    schemaVersion: '1', status: 'ready', reasonCode: null,
    paper: { slug: 'retry-paper', title: '恢复测试真题', subject: 'math' }, source: { label: '恢复测试真题原卷', questionCount: 1 },
    questions: [{ id: 99001, questionNumber: '1', pageNumber: 1, promptPreview: 'Recovery question', canAnswer: false }]
  }));
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/retry-paper/progress', (route) => json(route, {
    schemaVersion: '1', policyVersion: 'past-paper-answer-v1', paper: { id: 99, slug: 'retry-paper', title: '恢复测试真题', subject: 'math' },
    status: 'not_started', totalQuestions: 1, answerableQuestions: 0, startedCount: 0, submittedCount: 0, correctCount: 0,
    incorrectCount: 0, assistedCount: 0, evidenceCount: 0, timeSpentSeconds: 0, completionRate: 0, nextQuestionId: null, items: []
  }));

  await page.goto(`/agent?conversation=${conversationId}&agentPastPaper=retry-paper`);
  await expect(page.getByText('真题服务暂时不可用')).toBeVisible();
  await page.getByRole('button', { name: '重试加载' }).click();
  await expect(page.getByLabel('真题资料详情')).toContainText('恢复测试真题');
  await expect(page).toHaveURL(new RegExp(`/agent\\?.*agentPastPaper=retry-paper`));
  expect(detailRequests).toBe(2);
});

test('shows the latest evidence-driven decision in learning settings and starts it directly', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  const now = '2026-09-22T08:00:00.000Z';
  let startBody: Record<string, unknown> | null = null;
  await page.route((url) => url.pathname === '/api/v1/agent/journey/overview', (route) => json(route, {
    schemaVersion: '1', generatedAt: now,
    goal: { examDate: '2027-06-01', weeklyGoalDays: 5, totalTargetScore: 255, subjects: [{ subject: 'physics', targetScore: 85 }] },
    progress: { subjects: [] },
    nextDecision: {
      prescriptionId: 'prescription-latest', reasonSummary: 'The highest-priority coverage gap should be addressed with diagnostic.',
      reasonCodes: ['SYLLABUS_COVERAGE_INCOMPLETE', 'EVIDENCE_INSUFFICIENT'], confidence: 'low', estimatedMinutes: 10,
      source: 'learning_prescription', generatedByAI: false,
      primaryTask: { type: 'diagnostic', subject: 'chemistry', topicIds: [3], questionCount: 3, priority: 1 }
    },
    weaknesses: { stateSource: 'user_csca_topic_mastery_v1', subjects: [], reviewQueue: [] },
    resources: { source: 'published_past_papers', subjectScope: ['chemistry'], items: [] }
  }));
  await page.route('**/api/v1/agent/journey/prescriptions/prescription-latest/start', async (route) => {
    startBody = await route.request().postDataJSON();
    return json(route, {
      schemaVersion: '1', artifactId: 'decision-task-1', conversationId, sessionId: 71, roundId: 171,
      mode: 'diagnostic', questionCount: 3, subject: 'chemistry', questionLanguage: 'zh', toolName: 'create_adaptive_practice', taskType: 'diagnostic',
      route: '/agent', legacyRoute: '/csca-subjects/chemistry/practice/rounds/171',
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'diagnostic', subject: 'chemistry', reasonCodes: ['SYLLABUS_COVERAGE_INCOMPLETE'], objective: 'diagnostic:chemistry:3' }
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/171**', (route) => json(route, {
    session: { id: 71, userId: 42, subject: 'chemistry', mode: 'diagnostic', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 171, sessionId: 71, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: now, submittedAt: null, version: 1 },
    questions: [{ id: 1701, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '下列属于化学变化的是？', options: [{ id: 'A', text: '冰融化' }, { id: 'B', text: '铁生锈' }], topicId: 3, topicCode: 'chemical-change', topicTitle: '化学变化', position: 1 }]
  }));
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));

  await page.goto('/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  const currentDecision = page.locator('.agent-live-decision-card');
  await expect(currentDecision).toContainText('系统建议 · 不改变默认设置');
  await expect(currentDecision).toContainText('建议先完成化学短诊断');
  await expect(currentDecision).toContainText('为什么推荐这一项');
  await expect(currentDecision).toContainText('化学仍有知识点缺少独立作答记录，先用短诊断补齐覆盖。');
  await expect(currentDecision).not.toContainText('highest-priority');
  await expect(currentDecision).toContainText('系统会比较考试目标中的全部科目');
  await expect(currentDecision).toContainText('你的自由练习默认仍为');
  await expect(currentDecision).toContainText('数学 · 5 题');
  await expect(currentDecision).toContainText('规则决策，不由 AI 直接修改掌握度');
  await expect(currentDecision.getByRole('button', { name: '继续自由练数学 5 题' })).toBeVisible();
  await expect(page.locator('.agent-journey-plan-card')).toHaveCount(0);
  await expect(page.getByText('还没有可用计划', { exact: true })).toHaveCount(0);
  await currentDecision.getByRole('button', { name: '按建议做化学 3 题' }).click();
  await expect.poll(() => startBody).not.toBeNull();
  expect(startBody).toMatchObject({ questionLanguage: 'zh' });
  await expect(page).toHaveURL(/agentRoundId=171.*agentView=practice.*agentTaskType=diagnostic.*agentSubject=chemistry/);
  await expect(page.getByText('下列属于化学变化的是？')).toBeVisible();
});

test('retries a failed journey overview without reloading the Agent workspace', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  let overviewLoads = 0;
  await page.route((url) => url.pathname === '/api/v1/agent/journey/overview', (route) => {
    overviewLoads += 1;
    if (overviewLoads === 1) return json(route, { code: 'JOURNEY_OVERVIEW_UNAVAILABLE', message: '学习证据服务暂时不可用。' }, 503);
    return json(route, {
      schemaVersion: '1', generatedAt: '2026-09-23T08:00:00.000Z',
      goal: null,
      progress: { subjects: [] },
      nextDecision: null,
      weaknesses: { stateSource: 'user_csca_topic_mastery_v1', subjects: [], reviewQueue: [] },
      resources: { source: 'published_past_papers', subjectScope: [], items: [] }
    });
  });

  await page.goto('/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await expect(page.locator('.agent-async-state.is-error')).toHaveAttribute('role', 'alert');
  await expect(page.getByText('学习证据服务暂时不可用。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试读取', exact: true }).click();
  await expect.poll(() => overviewLoads).toBe(2);
  await expect(page.getByText('学习证据服务暂时不可用。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试读取', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '围绕目标，只保留一个明确的下一步' })).toBeVisible();
  await expect(page.locator('.agent-live-decision-card')).toHaveCount(0);
  await expect(page.locator('.agent-journey-plan-card')).toBeVisible();
});

test('tracks recommendation exposure and explains learning quality with actionable degradation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the learning-quality closure contract.');
  await mockAgentWorkspace(page);
  let exposureBody: Record<string, unknown> | null = null;
  await page.route((url) => url.pathname === '/api/v1/agent/journey/overview', (route) => json(route, {
    schemaVersion: '1', generatedAt: '2026-09-23T08:00:00.000Z',
    goal: { examDate: '2027-06-01', weeklyGoalDays: 5, totalTargetScore: 255, subjects: [{ subject: 'physics', targetScore: 85 }] },
    progress: { subjects: [{ subject: 'physics', totalTopicCount: 10, evidencedTopicCount: 4, strongTopicCount: 1, developingTopicCount: 2, needsAttentionTopicCount: 1, insufficientEvidenceTopicCount: 6, answerEvidenceCount: 12 }] },
    nextDecision: {
      prescriptionId: 'quality-p1', reasonSummary: '惯性判断仍需独立验证。', reasonCodes: ['INDEPENDENCE_OR_DIFFICULTY_LIMIT'], confidence: 'medium', estimatedMinutes: 10,
      source: 'learning_prescription', generatedByAI: false,
      availability: { status: 'limited', requestedCount: 5, availableCount: 2 },
      primaryTask: { type: 'targeted_practice', subject: 'physics', topicIds: [47], questionCount: 5, priority: 1 }
    },
    learningQuality: {
      schemaVersion: '1', policyVersion: 'learning-quality-v1', status: 'validating',
      evidence: { acceptedCount: 12, evidencedTopicCount: 4, totalTopicCount: 10, projectionPending: false },
      recommendationFunnel: { publishedCount: 2, shownCount: 2, acceptedCount: 1, terminalCount: 1, completedCount: 1, positiveOutcomeCount: 1, followThroughRate: 50, completionRate: 100, positiveOutcomeRate: 100 },
      validation: { stable: 1, notStable: 1, inconclusive: 0, pending: 1, contradictionCount: 1, strongWithActiveErrorCount: 1, weakWithStableValidationCount: 0 },
      supply: { status: 'limited', requestedCount: 5, availableCount: 2 },
      alerts: [
        { code: 'supply_gap', tone: 'warning', title: '当前建议的题源不足', body: '需要 5 题，目前可用 2 题；建议先复盘或改练其他知识点。', action: 'review' },
        { code: 'calibration_attention', tone: 'warning', title: '发现需要重新校准的判断', body: '有 1 个知识点的掌握状态与后续错误不一致。', action: 'review' }
      ],
      provenance: { generatedByAI: false, source: 'learning_evidence_and_outcomes', note: 'AI 可辅助讲解，但不直接修改掌握状态、校准结论或推荐效果。' }
    },
    weaknesses: { stateSource: 'user_csca_topic_mastery_v1', subjects: [], reviewQueue: [] },
    resources: { source: 'published_past_papers', subjectScope: ['physics'], items: [] }
  }));
  await page.route('**/api/v1/agent/journey/prescriptions/quality-p1/exposure', async (route) => {
    exposureBody = await route.request().postDataJSON();
    return json(route, { schemaVersion: '1', prescriptionId: 'quality-p1', recorded: true, shownAt: '2026-09-23T08:00:01.000Z' });
  });

  await page.goto('/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await expect.poll(() => exposureBody).not.toBeNull();
  expect(exposureBody).toEqual({ clientRequestId: 'agent-plan-shown:quality-p1', surface: 'agent_learning_plan' });
  await expect(page.locator('.agent-live-decision-card')).toContainText('题源不足：需要 5 题，可用 2 题');
  await expect(page.getByRole('button', { name: '先去复盘', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '学习质量', exact: true }).click();
  await expect(page.getByRole('heading', { name: '推荐是否真的有效' })).toBeVisible();
  await expect(page.getByLabel('学习质量')).toContainText('建议执行率');
  await expect(page.getByLabel('学习质量')).toContainText('50%');
  await expect(page.getByLabel('学习质量')).toContainText('当前建议的题源不足');
  await expect(page.getByLabel('学习质量')).toContainText('发现需要重新校准的判断');
  await expect(page.getByLabel('学习质量')).toContainText('AI 可辅助讲解，但不直接修改掌握状态');
  await page.getByRole('button', { name: '去复盘', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '错题与薄弱点', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('keeps learning settings open when a versioned save conflicts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the version-conflict contract.');
  await mockAgentWorkspace(page);
  await page.route('**/api/v1/me/agent-study-availability', (route) => json(route, {
    statusCode: 409, code: 'VERSION_CONFLICT', message: '学习时间设置已被其他会话更新'
  }, 409));

  await page.goto('/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await page.getByRole('button', { name: '学习时间', exact: true }).click();
  await page.getByLabel('默认单次时长').fill('45');
  await page.getByRole('button', { name: '保存学习时间', exact: true }).click();
  await expect(page.locator('.agent-settings-status')).toContainText('学习时间暂时无法保存，请刷新后重试');
  await expect(page.locator('.agent-settings-workspace')).toBeVisible();
  await expect(page.locator('.agent-composer')).toHaveCount(0);
});

test('creates the recommended practice and opens it inside the Agent workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the practice launch contract.');
  await mockAgentWorkspace(page);
  let requestBody: Record<string, unknown> | null = null;
  await page.route(`**/api/v1/agent/artifacts/${artifactId}/start-practice`, async (route) => {
    requestBody = await route.request().postDataJSON();
    return json(route, {
      schemaVersion: '1', artifactId, conversationId, sessionId: 51, roundId: 81,
      mode: 'diagnostic', questionCount: 20, subject: 'math', questionLanguage: 'zh',
      toolName: 'create_adaptive_practice', taskType: 'diagnostic',
      route: `/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`,
      legacyRoute: `/csca-subjects/math/practice/rounds/81?agentConversationId=${conversationId}&agentArtifactId=${artifactId}`,
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'diagnostic', subject: 'math', reasonCodes: [], objective: null }
    });
  });
  const now = '2026-09-15T10:00:00.000Z';
  const startedRound = {
    session: { id: 51, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 81, sessionId: 51, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: now, submittedAt: null, version: 1 },
    questions: [{ id: 101, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '开始后应当直接看到这道函数题。', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], topicId: 67, topicCode: 'function', topicTitle: '函数', position: 1 }]
  };
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81**', (route) => json(route, startedRound));
  await page.goto('/agent');
  const startLearning = page.getByRole('button', { name: '开始学习', exact: true });
  await expect(startLearning).toBeVisible();
  await startLearning.click();
  await expect(page).toHaveURL(new RegExp(`/agent\\?.*agentRoundId=81`));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('开始后应当直接看到这道函数题。');
  await expect(page.getByText('短诊断 · 数学')).toBeVisible();
  await expect(page.getByLabel('Agent 学习任务工作区').getByText('先完成一次短诊断，再根据结果调整训练。')).toBeVisible();
  expect(requestBody?.questionLanguage).toBe('zh');
  expect(typeof requestBody?.clientRequestId).toBe('string');
});

test('keeps free-practice defaults separate and preserves the current batch when continuing', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('moodlelike.agent.freePracticeSubject', 'physics');
    window.localStorage.setItem('moodlelike.agent.freePracticeCount', '10');
  });
  const now = '2026-09-15T10:00:00.000Z';
  const roundReport = {
    session: { id: 51, userId: 42, subject: 'math', mode: 'diagnostic', status: 'completed', questionLanguage: 'zh', startedAt: now, completedAt: now, createdAt: now, updatedAt: now },
    round: { id: 81, sessionId: 51, roundIndex: 1, status: 'completed', plannerSnapshot: { mode: 'diagnostic' }, answers: { '101': 'A' }, timeSpent: { '101': 16 }, currentQuestion: 1, correctCount: 0, wrongCount: 1, unansweredCount: 0, startedAt: now, submittedAt: now, version: 2 },
    summary: { correctCount: 2, wrongCount: 3, unansweredCount: 0, total: 5, accuracy: 40, totalSeconds: 16 },
    weakTopics: [{ topicId: 67, code: 'function', title: '函数与方程' }],
    diagnosticCoverage: { subject: 'math', coveredCount: 2, totalCount: 4, coverageRate: 50, confidenceReadyCount: 2, lowConfidenceCount: 2, coveredDimensions: [], insufficientDimensions: [] },
    nextRecommendation: 'continue_weak_topics',
    learningDecision: {
      schemaVersion: '1', policyVersion: 'adaptive-mastery-decision-v1', generatedByAI: false,
      source: 'rules_and_learning_evidence', adaptationPending: true, status: 'needs_review',
      headline: '先修复本轮暴露的薄弱点', explanation: '本轮错误会进入复习队列；完成复盘后还需要用新题独立验证。',
      evidenceBasis: { answeredCount: 5, firstAttemptCount: 5, independentCorrectCount: 2, assistedCorrectCount: 0, averageSeconds: 16, stateSource: 'learning_state_v2' },
      topics: [{ topicId: 67, code: 'function', title: '函数与方程', status: 'needs_review', reasons: ['本轮仍有错误'], total: 5, correct: 2, unanswered: 0, independentCorrect: 2, assistedCorrect: 0, firstAttemptCount: 5, averageSeconds: 16, state: { source: 'learning_state_v2', mastery: .32, confidence: .6, independence: .55, retention: .4, fluency: .5, transfer: .4, consistency: .5, coverage: .4, evidenceCount: 5, stateVersion: 'state-5' }, reviewPattern: { id: 71, patternType: 'concept_gap', status: 'active', recurrenceCount: 3, nextReviewAt: null, consecutiveVerificationPassCount: 0 } }],
      nextStep: { type: 'review_mistakes', label: '复习本轮错题', reason: '先理解“函数与方程”的错误原因，再做同类新题。', subject: 'math', topicId: 67, reviewItemId: 71, patternType: 'concept_gap', dueAt: null, questionCount: 3 }
    },
    remediationPlan: { triggered: false, trigger: null, conceptCards: [], variantPractice: { availableCount: 0, questionIds: [] }, nextAction: 'continue' },
    items: [{ id: 101, orderNumber: 1, position: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '函数 y=2x+1 的斜率是多少？', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], topicId: 67, topicCode: 'function', topicTitle: '函数与方程', selectedAnswer: 'A', correctAnswer: 'B', isCorrect: false, isUnanswered: false, explanation: '一次函数中 x 的系数是斜率。', knowledgeTags: ['函数'], timeSpentSeconds: 16, mastery: .32 }]
  };
  let reportAttempts = 0;
  let continuationBody: Record<string, unknown> | null = null;
  const freeTaskArtifact = {
    ...artifact,
    id: 'free-task-1',
    type: 'learning_task',
    status: 'completed',
    snapshot: {
      schemaVersion: '1', source: 'student_initiated',
      task: { type: 'free_practice', subject: 'math', questionCount: 5 },
      freePracticeJourneyId: 'free-task-1', batchIndex: 1, journeyStatus: 'active', roundId: 81
    }
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, { ...conversation, artifacts: [...conversation.artifacts, freeTaskArtifact] }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81/report**', (route) => {
    reportAttempts += 1;
    return reportAttempts === 1 ? json(route, { message: 'temporary report outage' }, 503) : json(route, roundReport);
  });
  await page.route('**/api/v1/agent/practice-rounds/81/settle', (route) => json(route, { schemaVersion: '1', artifactId: 'free-task-1', roundId: 81, decision: 'completed' }));
  await page.route('**/api/v1/agent/interventions/offer', (route) => json(route, {
    schemaVersion: '1', suppressedReason: null,
    item: {
      schemaVersion: '1', id: 'delivery-report-1', interventionId: 'intervention-report-1', status: 'offered', placement: 'after_round',
      subjectCode: 'math', topicId: 67, action: 'concept_learning', urgency: 'medium',
      reasonSummary: '本轮函数与方程错题较集中，建议先用 4 分钟巩固共同错因。', triggerCodes: ['ROUND_WEAK_TOPIC'],
      content: { sourceType: 'concept_card', sourceId: 'card-67', sourceVersion: 'v1', title: '函数与方程巩固', body: '', example: null, topicTitle: '函数与方程', teachingAsset: null },
      offeredAt: now, startedAt: null, completedAt: null, deferredUntil: null, skippedAt: null, masteryChanged: false
    }
  }));
  await page.route('**/api/v1/agent/free-practice/free-task-1/continue', async (route) => {
    continuationBody = await route.request().postDataJSON();
    return json(route, {
      schemaVersion: '1', artifactId: 'free-task-2', conversationId, sessionId: 52, roundId: 82,
      mode: 'practice', questionCount: 5, subject: 'math', questionLanguage: 'zh', toolName: 'continue_student_initiated_practice', taskType: 'free_practice',
      route: `/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=free-task-2&agentRoundId=82&agentView=practice&agentTaskType=free_practice&agentSubject=math`,
      legacyRoute: '/csca-subjects/math/practice/rounds/82', journeyId: 'free-task-1', batchIndex: 2,
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: 'math', reasonCodes: ['student_initiated', 'continuous_batch'], objective: null }
    });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/82**', (route) => json(route, { message: 'mock next round intentionally unavailable' }, 503));

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=free-task-1&agentRoundId=81&agentView=report&agentTaskType=free_practice&agentSubject=math`);

  const reportError = page.getByRole('alert').filter({ hasText: '本轮结果暂时无法加载' });
  await expect(reportError).toContainText('学习结果还没有载入');
  await page.getByRole('button', { name: '重试加载' }).click();
  await expect(page.getByLabel('本轮学习报告')).toBeVisible();
  await expect(page.getByText('结果、学习证据与下一步')).toBeVisible();
  await expect(page.getByLabel('本轮学习报告').getByRole('heading', { name: '先修复本轮暴露的薄弱点' })).toBeVisible();
  await expect(page.getByLabel('本轮学习报告').getByText('本轮错误会进入复习队列；完成复盘后还需要用新题独立验证。')).toBeVisible();
  await expect(page.getByLabel('本轮学习报告')).toContainText('独立答对2/5');
  await expect(page.getByLabel('本轮学习报告')).toContainText('规则判断 · 来自真实作答证据');
  await expect(page.getByLabel('本轮学习报告').getByRole('button', { name: '复习本轮错题' })).toBeVisible();
  await expect(page.getByLabel('本轮学习报告').getByRole('button', { name: '查看学习计划' })).toBeVisible();
  await expect(page.getByLabel('本轮学习报告').locator('.agent-report-disclosures details').nth(1)).toContainText('查看题目明细1');
  const embeddedSuggestion = page.getByLabel('本轮学习报告').locator('.agent-intervention-card.is-embedded');
  await expect(embeddedSuggestion).toContainText('针对本轮 · 巩固建议');
  await expect(embeddedSuggestion).toContainText('本轮函数与方程错题较集中');
  await expect(page.locator('.agent-intervention-card:not(.is-embedded)')).toHaveCount(0);
  await expect(page.getByText('一次函数中 x 的系数是斜率。')).toBeHidden();
  await expect(page.getByLabel('Agent 学习任务工作区')).toHaveCount(0);
  const reportRail = page.getByRole('complementary', { name: '本轮结果与下一步' });
  if (testInfo.project.name === 'desktop') {
    await expect(reportRail).toBeVisible();
    await expect(reportRail).toContainText('40%');
    await expect(reportRail).toContainText('函数与方程');
    await expect(reportRail.getByRole('button', { name: '继续下一批' })).toBeVisible();
    await expect(reportRail.getByRole('button', { name: /这轮有疑问/ })).toBeVisible();
  } else {
    await expect(reportRail).toHaveCount(0);
    await expect(page.getByLabel('本轮学习报告').getByRole('button', { name: '继续下一批', exact: true })).toBeVisible();
  }
  await expect(page.getByText('继续下一批会沿用本批科目和题量；如需改变，只调整下一批。')).toHaveCount(0);
  const continueButton = testInfo.project.name === 'desktop'
    ? reportRail.getByRole('button', { name: '继续下一批', exact: true })
    : page.getByLabel('本轮学习报告').getByRole('button', { name: '继续下一批', exact: true });
  await continueButton.click();
  await expect(page).toHaveURL(/agentRoundId=82/);
  expect(continuationBody).toMatchObject({ subject: 'math', questionCount: 10, questionLanguage: 'zh' });
  await expect(page.locator('.agent-composer')).toHaveCount(0);
  expect(reportAttempts).toBeGreaterThanOrEqual(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('keeps the active question stable while rendering current learning assistance', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('moodlelike.agent.practiceQaConversation.81', 'conversation-1');
    window.localStorage.setItem('moodlelike.agent.practiceQaConversation.81.101', 'stale-practice-qa');
  });
  const now = '2026-09-15T10:00:00.000Z';
  const roundDetail = {
    session: { id: 51, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 81, sessionId: 51, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: now, submittedAt: null, version: 1 },
    questions: [{ id: 101, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '函数 y=2x+1 的斜率是多少？', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], topicId: 67, topicCode: 'function', topicTitle: '函数', position: 1 }]
  };
  const assistanceHistory: Array<Record<string, unknown>> = [];
  const availability = {
    schemaVersion: '1', roundId: 81, questionId: 101, policyVersion: 'assistance-v1', contextVersion: 'ctx-1', recommendedAction: 'recall_concept', maxAllowedLevel: 'A2',
    exposures: { usedHint: false, usedExplanation: false }, billing: { enabled: true, unlimited: false, balanceUnits: 50, aiActionMayConsumeCredits: true }, history: [],
    availableActions: [
      { action: 'recall_concept', level: 'A1', enabled: true, reasonCode: null, generatedByAI: false, confirmationRequired: false },
      { action: 'next_step_hint', level: 'A2', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
      { action: 'show_full_solution', level: 'A6', enabled: false, reasonCode: 'answer_required', generatedByAI: false, confirmationRequired: true }
    ]
  };
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81**', (route) => {
    if (route.request().method() === 'PATCH') return json(route, roundDetail.round);
    return json(route, roundDetail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81/check', (route) => json(route, {
    questionId: 101, selected: 'A', correctAnswer: 'B', isCorrect: false,
    explanation: '一次函数 y=kx+b 中，k 是斜率。', knowledgeTags: ['函数']
  }));
  await page.route('**/api/v1/agent/practice-rounds/81/questions/101/teaching-asset**', (route) => json(route, {
    schemaVersion: '1', gapReason: null,
    item: {
      id: 'asset-question-1', stableKey: 'math-function-shift', type: 'interactive_visualizer', subjectCode: 'math',
      versionId: 'asset-question-version-1', version: 1, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 4,
      renderer: 'interactive_component', payloadSchemaVersion: '1', resolverVersion: 'teaching-asset-resolver-v2', topicTitle: '函数',
      title: '用图像理解函数变化', summary: '调整参数，观察图像变化。', instructions: ['先观察参数。', '再比较图像。'],
      component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 2 } },
      activePrompt: { id: 'prompt-question-1', prompt: '参数变化会怎样影响图像？', options: [{ id: 'right', label: '向右移动' }, { id: 'left', label: '向左移动' }] },
      verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false },
      fallback: {}, sourceRefs: [], reviewState: 'published', publishedAt: now
    }
  }));
  let requestedAction = '';
  let practiceQaConversationCreates = 0;
  let practiceQaConversationCreateBody: Record<string, unknown> | null = null;
  let practiceQaSubmission: Record<string, unknown> | null = null;
  const practiceQaConversation = {
    id: 'practice-qa-1', status: 'active', title: '数学练习问答 · 第 1 题',
    lastMessageAt: now, createdAt: now, updatedAt: now,
    messages: [
      { id: 'practice-question-1', conversationId: 'practice-qa-1', role: 'user', content: { schemaVersion: '1', surface: 'subject_qa', text: '为什么先看斜率？', pageContext: { questionContext: { roundId: 81, questionId: 101 } } }, clientMessageId: 'practice-client-1', runId: 'practice-run-1', createdAt: now },
      { id: 'practice-answer-1', conversationId: 'practice-qa-1', role: 'assistant', content: { schemaVersion: '1', surface: 'subject_qa', text: '因为一次函数中 x 的系数就是斜率。', subjectQa: { decision: 'answer', subject: 'math', generatedByAI: true, masteryChanged: false } }, clientMessageId: null, runId: 'practice-run-1', createdAt: now }
    ],
    artifacts: []
  };
  await page.route(/\/api\/v1\/agent\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    practiceQaConversationCreates += 1;
    practiceQaConversationCreateBody = await route.request().postDataJSON();
    return json(route, { ...practiceQaConversation, messages: undefined, artifacts: undefined });
  });
  await page.route('**/api/v1/agent/conversations/practice-qa-1/messages', async (route) => {
    practiceQaSubmission = await route.request().postDataJSON();
    return json(route, { messageId: 'practice-question-1', runId: 'practice-run-1', status: 'queued', eventsUrl: '/events' });
  });
  await page.route('**/api/v1/agent/conversations/practice-qa-1', (route) => json(route, practiceQaConversation));
  await page.route('**/api/v1/agent/conversations/stale-practice-qa', (route) => json(route, {
    ...practiceQaConversation,
    id: 'stale-practice-qa',
    title: '另一道题的练习问答',
    messages: [{
      id: 'stale-question', conversationId: 'stale-practice-qa', role: 'user', clientMessageId: 'stale-client', runId: 'stale-run', createdAt: now,
      content: { schemaVersion: '1', surface: 'subject_qa', text: '上一题为什么错？', pageContext: { questionContext: { roundId: 80, questionId: 99 } } }
    }]
  }));
  await page.route('**/api/v1/agent/runs/practice-run-1', (route) => json(route, {
    id: 'practice-run-1', conversationId: 'practice-qa-1', userId: 42, status: 'completed', channel: 'web', traceId: 'practice-trace-1',
    startedAt: now, completedAt: now, errorCode: null, errorRetryable: null, artifacts: [], toolCalls: []
  }));
  await page.route('**/api/v1/agent/practice-rounds/81/questions/101/assistance', async (route) => {
    if (route.request().method() === 'GET') return json(route, { ...availability, history: assistanceHistory });
    requestedAction = String((await route.request().postDataJSON()).action || '');
    const response = {
      ...availability,
      requestId: 'request-assistance-1', toolCallId: 'tool-assistance-1', action: requestedAction, level: 'A1',
      content: '一次函数 y=kx+b 中，k 表示斜率。', generatedByAI: false, interaction: null,
      exposure: { action: requestedAction, level: 'A1', recordedAt: now }
    };
    assistanceHistory.splice(0, assistanceHistory.length, { toolCallId: response.toolCallId, action: response.action, level: response.level, content: response.content, generatedByAI: response.generatedByAI, createdAt: now });
    return json(route, response);
  });
  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.locator('.agent-handwriting-input')).toHaveCount(0);
  await expect(page.locator('input[type="file"]:visible')).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge')).toBeVisible();
  await expect(page.getByLabel('当前练习题上下文')).toHaveCount(0);
  await page.getByLabel('Agent 学习任务工作区').getByRole('button', { name: '打开学习工具' }).click();
  const calculator = page.getByLabel('科学计算器');
  await expect(calculator).toBeVisible();
  await calculator.getByLabel('计算表达式').fill('2×(3+4)');
  await calculator.getByRole('button', { name: '=', exact: true }).click();
  await expect(calculator.locator('output')).toHaveText('14');
  await page.getByRole('button', { name: '单位换算', exact: true }).click();
  await expect(page.locator('.agent-unit-converter > output')).toContainText('1');
  await expect(page.locator('.agent-unit-converter > output')).toContainText('千米 km');
  await page.getByRole('button', { name: '公式与常量', exact: true }).click();
  await expect(page.getByText('一元二次方程')).toBeVisible();
  await page.getByLabel('搜索公式').fill('斜率');
  await expect(page.getByText('直线斜率')).toBeVisible();
  await expect(page.getByText('一元二次方程')).toHaveCount(0);
  await page.getByRole('button', { name: '函数绘图', exact: true }).click();
  await expect(page.getByRole('img', { name: '函数 x^2 的图像' })).toBeVisible();
  await page.getByLabel('函数表达式').fill('sin(x)');
  await expect(page.getByRole('img', { name: '函数 sin(x) 的图像' })).toBeVisible();
  await page.getByRole('button', { name: '草稿纸', exact: true }).click();
  await page.getByPlaceholder('记录计算步骤、公式或解题思路……').fill('斜率等于 x 的系数');
  expect(practiceQaConversationCreates).toBe(0);
  await page.getByRole('button', { name: '本题问答', exact: true }).click();
  const assistanceBridge = page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge');
  if (await assistanceBridge.isVisible()) await assistanceBridge.click();
  await expect(page.getByRole('heading', { name: '本题问答 · 第 1 题' })).toBeVisible();
  await expect(page.getByLabel('当前练习题上下文')).toContainText('当前第 1/1 题');
  await expect(page.getByText('上一题为什么错？')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('moodlelike.agent.practiceQaConversation.81.101'))).toBeNull();
  await expect(page.getByText('我今天该学什么？')).toHaveCount(0);
  expect(practiceQaConversationCreates).toBe(0);
  await page.getByRole('button', { name: '学习工具', exact: true }).click();
  await page.getByRole('button', { name: '草稿纸', exact: true }).click();
  await expect(page.getByPlaceholder('记录计算步骤、公式或解题思路……')).toHaveValue('斜率等于 x 的系数');
  await page.getByRole('button', { name: '本题问答', exact: true }).click();
  await page.getByLabel('围绕当前题提问').fill('为什么先看斜率？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText('因为一次函数中 x 的系数就是斜率。')).toBeVisible();
  expect(await page.locator('.agent-practice-qa-composer').evaluate((root) => {
    const context = root.querySelector('.agent-practice-action-panel');
    const composer = root.querySelector('.agent-composer-box');
    return Boolean(context && composer && (context.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  expect(practiceQaConversationCreates).toBe(1);
  expect(practiceQaConversationCreateBody).toMatchObject({
    title: '数学练习问答 · 第 1 题',
    scope: { type: 'practice_question_qa', roundId: 81, questionId: 101 }
  });
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.practiceQaConversation.81.101'))).toBe('practice-qa-1');
  expect(practiceQaSubmission).toMatchObject({
    surface: 'subject_qa',
    text: '为什么先看斜率？',
    pageContext: { questionContext: { roundId: 81, questionId: 101, questionNumber: 1, subject: 'math', answered: false } }
  });
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await page.getByRole('button', { name: '学习方式', exact: true }).click();
  await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /自由练习/ }).click();
  await page.getByRole('button', { name: '做题', exact: true }).click();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('函数 y=2x+1 的斜率是多少？');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await page.getByRole('button', { name: '学习方式', exact: true }).click();
  await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /智能推荐/ }).click();
  await page.getByRole('button', { name: '做题', exact: true }).click();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('函数 y=2x+1 的斜率是多少？');
  await expect(page.getByLabel('Agent 学习任务工作区')).not.toContainText(/AI\s*\d+\s*次|AI\s*额度/);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-panel')).toHaveCount(0);
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge')).toBeVisible();
  } else {
    await expect(page.getByLabel('当前练习题上下文')).toBeVisible();
  }
  await page.getByLabel('当前练习题上下文').getByRole('button', { name: '回忆知识点' }).click();
  await expect(page.locator('.agent-practice-assistance-message')).toContainText('一次函数 y=kx+b 中，k 表示斜率。');
  expect(requestedAction).toBe('recall_concept');
  await page.getByRole('button', { name: '关闭本题问答，返回做题' }).click();
  await expect(page.getByRole('heading', { name: '本题问答 · 第 1 题' })).toHaveCount(0);
  await page.getByLabel('Agent 学习任务工作区').getByRole('button', { name: 'A 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本题问答 · 第 1 题' })).toBeVisible();
  await expect(page.getByLabel('当前题提问引导')).toContainText('哪里没想通，可以继续问我');
  await expect(page.getByLabel('当前题提问引导')).not.toContainText('正确答案 B');
  await expect(page.getByLabel('当前题提问引导')).not.toContainText('一次函数 y=kx+b 中，k 是斜率。');
  await expect(page.getByLabel('当前题知识讲解')).toContainText('当前题知识讲解');
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.special-explanation-box')).toHaveCount(0);
  expect(await page.locator('.agent-message-list').evaluate((root) => {
    const invite = root.querySelector('.agent-practice-question-invite-message');
    const teaching = root.querySelector('.agent-practice-teaching-resource');
    return Boolean(invite && teaching && (invite.compareDocumentPosition(teaching) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.getByLabel('围绕当前题提问').fill('为什么 A 错了？');
  await page.getByRole('button', { name: '发送' }).click();
  await expect.poll(() => practiceQaSubmission).toMatchObject({
    surface: 'subject_qa',
    text: '为什么 A 错了？',
    pageContext: {
      questionContext: {
        roundId: 81,
        questionId: 101,
        selectedAnswer: 'A',
        answered: true,
        correctAnswer: 'B',
        isCorrect: false,
        explanation: '一次函数 y=kx+b 中，k 是斜率。',
        knowledgeTags: ['函数']
      }
    }
  });
  expect(await page.locator('.agent-message-list').evaluate((root) => {
    const teaching = root.querySelector('.agent-practice-teaching-resource');
    const userMessage = root.querySelector('.agent-message-block.user');
    return Boolean(teaching && userMessage && (userMessage.compareDocumentPosition(teaching) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-micro-lesson-card')).toHaveCount(0);
  await page.getByRole('button', { name: '收起讲解' }).click();
  await expect(page.getByRole('button', { name: '展开讲解' })).toBeVisible();
  await page.getByRole('button', { name: '展开讲解' }).click();
  await expect(page.getByLabel('当前题知识讲解')).toContainText('当前题知识讲解');
  await page.getByRole('button', { name: '关闭本题问答，返回做题' }).click();
  await expect(page.getByRole('heading', { name: '本题问答 · 第 1 题' })).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await page.reload();
  await page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge').click();
  await expect(page.locator('.agent-practice-assistance-message')).toContainText('一次函数 y=kx+b 中，k 表示斜率。');
});

test('keeps current-question Q&A closed after a correct answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the correct-answer panel contract.');
  await mockAgentWorkspace(page);
  const now = '2026-09-15T10:00:00.000Z';
  const roundDetail = {
    session: { id: 52, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 83, sessionId: 52, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: now, submittedAt: null, version: 1 },
    questions: [{ id: 103, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '函数 y=2x+1 的斜率是多少？', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], topicId: 67, topicCode: 'function', topicTitle: '函数', position: 1 }]
  };
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/83**', (route) => {
    if (route.request().method() === 'PATCH') return json(route, roundDetail.round);
    return json(route, roundDetail);
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/83/check', (route) => json(route, {
    questionId: 103, selected: 'B', correctAnswer: 'B', isCorrect: true,
    explanation: '一次函数 y=kx+b 中，k 是斜率。', knowledgeTags: ['函数']
  }));
  await page.route('**/api/v1/agent/practice-rounds/83/questions/103/assistance', (route) => json(route, {
    schemaVersion: '1', roundId: 83, questionId: 103, policyVersion: 'assistance-v1', contextVersion: 'ctx-1', recommendedAction: 'recall_concept', maxAllowedLevel: 'A2',
    exposures: { usedHint: false, usedExplanation: false }, billing: { enabled: true, unlimited: false, balanceUnits: 50, aiActionMayConsumeCredits: true }, history: [], availableActions: []
  }));
  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=83&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge')).toBeVisible();
  await page.getByLabel('Agent 学习任务工作区').getByRole('button', { name: 'B 2', exact: true }).click();
  await expect(page.getByLabel('Agent 学习任务工作区')).toContainText('答对了');
  await expect(page.getByRole('heading', { name: '本题问答 · 第 1 题' })).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge')).toBeVisible();
});

test('starts a recommended mock exam and keeps the timed attempt inside the Agent workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the native mock exam contract.');
  await mockAgentWorkspace(page);
  const mockArtifact = {
    ...artifact,
    title: '完成一次数学在线模考',
    summary: '用整卷表现校准当前分数差距与时间分配。',
    route: '/agent',
    snapshot: {
      ...artifact.snapshot,
      task: { type: 'mock_exam', subject: 'math', questionCount: 48 },
      estimatedMinutes: 60,
      route: '/agent'
    }
  };
  const mockConversation = { ...conversation, artifacts: [mockArtifact] };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, { ...journeyState, plans: [mockArtifact] }));
  await page.route(/\/api\/v1\/agent\/conversations(?:\?.*)?$/, (route) => json(route, [mockConversation]));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, mockConversation));
  await page.route(`**/api/v1/agent/artifacts/${artifactId}/start-mock-exam`, (route) => json(route, {
    schemaVersion: '1', artifactId, conversationId, attemptId: 901,
    paperSlug: 'math-mock-1', paperTitle: '数学在线模考 1', subject: 'math', questionLanguage: 'zh',
    toolName: 'start_mock_exam', taskType: 'mock_exam', mode: 'initial_diagnostic',
    route: `/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentMockExamAttemptId=901&agentView=mock-exam&agentTaskType=mock_exam&agentSubject=math`,
    legacyRoute: '/csca-mock-exam/attempts/901',
    workspace: { kind: 'mock_exam', phase: 'taking', taskType: 'mock_exam', subject: 'math', reasonCodes: ['EXAM_EXECUTION_GAP'], objective: 'mock_exam:math' }
  }));
  const paper = {
    id: 1, subject: 'math', slug: 'math-mock-1', title: '数学在线模考 1', description: '数学整卷诊断。',
    language: 'zh', questionCount: 1, durationMinutes: 60, priceLabel: '免费', isFree: true, isLocked: false
  };
  const attempt = {
    id: 901, paper, language: 'zh', startedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 3_600_000).toISOString(),
    submittedAt: null, answers: {}, markedQuestions: [], timeSpent: {}, currentQuestion: 1, version: 1
  };
  await page.route('**/api/v1/csca-mock-exam/attempts/901**', (route) => {
    if (route.request().method() === 'PATCH') return json(route, attempt);
    return json(route, {
      attempt,
      questions: [{ id: 101, orderNumber: 1, questionType: 'single-choice', prompt: '函数 y=2x+1 与 y 轴交于哪一点？', options: [{ id: 'A', text: '(0, 1)' }, { id: 'B', text: '(1, 0)' }] }]
    });
  });
  const submittedAttempt = { ...attempt, startedAt: '2026-09-15T08:29:00.000Z', submittedAt: '2026-09-15T08:30:00.000Z', answers: { '101': 'A' }, version: 2 };
  const report = {
    attempt: submittedAttempt,
    summary: { score: 100, correctCount: 1, wrongCount: 0, unansweredCount: 0, total: 0, totalSeconds: 0, averageSeconds: 0 },
    knowledgeStats: [{ tag: '一次函数', total: 1, wrong: 0 }],
    items: [{ id: 101, orderNumber: 1, questionType: 'single-choice', prompt: '函数 y=2x+1 与 y 轴交于哪一点？', options: [{ id: 'A', text: '(0, 1)' }, { id: 'B', text: '(1, 0)' }], selected: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, isMarked: false, explanation: '令 x=0。', knowledgeTags: ['一次函数'], secondsSpent: 30 }]
  };
  await page.route('**/api/v1/csca-mock-exam/attempts/901/submit', (route) => json(route, report));
  await page.route('**/api/v1/csca-mock-exam/attempts/901/report**', (route) => json(route, report));
  let settlementAttempts = 0;
  await page.route('**/api/v1/agent/mock-exam-attempts/901/settle', (route) => {
    settlementAttempts += 1;
    if (settlementAttempts === 1) return json(route, { message: 'temporary settlement outage' }, 503);
    return json(route, {
      schemaVersion: '1', artifactId, attemptId: 901, decision: 'completed', subject: 'math', paperSlug: 'math-mock-1', paperTitle: '数学在线模考 1', score: 100, correctCount: 1, wrongCount: 0, unansweredCount: 0, submittedAt: submittedAttempt.submittedAt,
      learningReview: {
        status: 'ready',
        evidence: { sourceType: 'mock_exam', sourceId: '901', acceptedCount: 1 },
        result: { score: 100, correctCount: 1, wrongCount: 0, unansweredCount: 0 },
        focusTopics: [{ title: '一次函数', attemptedCount: 1, incorrectCount: 0, accuracy: 100 }],
        targetGap: { gapSnapshotId: 'gap-2', goalId: 'goal-1', totalGapCount: 2, subjectGapCount: 1, priorityGapCount: 1, topSubjectGaps: [] },
        nextDecision: {
          prescriptionId: 'rx-2', reasonSummary: '下一步优先稳定函数应用。', confidence: 'high', estimatedMinutes: 20,
          primaryTask: { type: 'targeted_practice', subject: 'math', topicIds: [10], questionCount: 5, priority: 1 }
        },
        provenance: { resultSource: 'submitted_mock_exam', nextTaskSource: 'learning_prescription', automaticQuestionGenerationInvoked: false }
      }
    });
  });
  const nextRunId = 'run-after-mock-1';
  const nextArtifactId = 'artifact-after-mock-1';
  const nextArtifact = {
    ...artifact,
    id: nextArtifactId,
    runId: nextRunId,
    title: '模考后的数学巩固任务',
    summary: '先完成一次函数针对性练习，再观察稳定性。',
    domainEntityId: 'rx-2',
    snapshot: { ...artifact.snapshot, task: { type: 'targeted_practice', subject: 'math', topicIds: [10], questionCount: 5 }, estimatedMinutes: 20 }
  };
  const nextConversation = {
    ...mockConversation,
    messages: [...mockConversation.messages, {
      id: 'message-after-mock', conversationId, role: 'assistant', clientMessageId: null, runId: nextRunId,
      createdAt: '2026-09-15T08:31:00.000Z',
      content: { schemaVersion: '1', text: '已根据刚完成的模考生成下一项任务。', artifactIds: [nextArtifactId] }
    }],
    artifacts: [{ ...mockArtifact, status: 'completed' }, nextArtifact]
  };
  let continuationReady = false;
  let continuationBody: Record<string, any> | null = null;
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, continuationReady ? nextConversation : mockConversation));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/messages(?:\\?.*)?$`), async (route) => {
    continuationBody = await route.request().postDataJSON();
    return json(route, { messageId: 'message-next', runId: nextRunId, status: 'queued', eventsUrl: `/api/v1/agent/runs/${nextRunId}/events` });
  });
  await page.route(new RegExp(`/api/v1/agent/runs/${nextRunId}/events(?:\\?.*)?$`), (route) => {
    continuationReady = true;
    const event = { eventId: 'event-next', runId: nextRunId, conversationId, sequence: 1, type: 'run.completed', createdAt: '2026-09-15T08:31:00.000Z', data: {} };
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `id: 1\ndata: ${JSON.stringify(event)}\n\n` });
  });
  await page.route(new RegExp(`/api/v1/agent/runs/${nextRunId}(?:\\?.*)?$`), (route) => json(route, {
    id: nextRunId, conversationId, userId: 42, status: 'completed', channel: 'web', traceId: 'trace-next',
    startedAt: '2026-09-15T08:30:30.000Z', completedAt: '2026-09-15T08:31:00.000Z', errorCode: null, errorRetryable: null,
    artifacts: [nextArtifact], toolCalls: []
  }));

  await page.goto('/agent');
  await page.getByRole('button', { name: '开始学习', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/agent\\?.*agentMockExamAttemptId=901`));
  await expect(page.getByLabel('Agent 在线模考工作区')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Agent 在线模考工作区')).toBeVisible();
  await expect(page.getByText('专注考试模式')).toBeVisible();
  await expect(page.getByText('函数 y=2x+1 与 y 轴交于哪一点？')).toBeVisible();
  await page.getByLabel('Agent 在线模考工作区').getByRole('button', { name: '打开学习工具' }).click();
  await expect(page.getByRole('region', { name: '学习工具' })).toBeVisible();
  await expect(page.getByRole('button', { name: '草稿纸', exact: true })).toHaveClass(/active/);
  await page.getByRole('button', { name: '科学计算器', exact: true }).click();
  await expect(page.getByText('在线模考按正式考试环境执行，当前不开放计算器。')).toBeVisible();
  await page.getByRole('button', { name: '单位换算', exact: true }).click();
  await expect(page.getByText('在线模考按正式考试环境执行，当前只开放草稿纸。')).toBeVisible();
  await page.getByRole('button', { name: '草稿纸', exact: true }).click();
  await page.getByPlaceholder('记录计算步骤、公式或解题思路……').fill('模考草稿不会写入问答');
  await page.getByRole('button', { name: '关闭学习辅助，返回做题' }).click();
  await expect(page.locator('.site-header')).toHaveCount(0);
  await page.getByRole('button', { name: /\(0, 1\)/ }).click();
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.getByRole('button', { name: '确认交卷', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/agent\\?.*agentView=mock-report`));
  await expect(page.getByLabel('模考学习报告')).toBeVisible();
  await expect(page.getByText('模考结果与下一步建议')).toBeVisible();
  await expect(page.getByLabel('Agent 在线模考工作区')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: '模考报告与下一步' })).toBeVisible();
  await expect(page.getByText('这套卷完成得比较稳定。')).toBeVisible();
  await expect(page.getByLabel('模考学习报告')).toContainText('正确1/1');
  await expect(page.getByLabel('模考学习报告')).toContainText('总用时1:00');
  await expect(page.getByText('Agent 建议')).toBeVisible();
  await expect(page.getByText('成绩已记录；学习证据同步未完成，可重试同步或先复盘错题。')).toBeVisible();
  await page.getByRole('button', { name: '重试同步' }).click();
  await expect(page.getByText('下一步优先稳定函数应用。')).toBeVisible();
  await expect(page.getByRole('button', { name: /返回套卷列表/ })).toHaveCount(0);
  expect(settlementAttempts).toBe(2);
  await page.reload();
  await expect(page.getByLabel('模考学习报告')).toBeVisible();
  await expect(page.getByLabel('Agent 在线模考工作区')).toHaveCount(0);
  await page.getByRole('button', { name: '开始建议任务' }).click();
  await expect(page).toHaveURL(/\/zh\/agent$/);
  await expect(page).not.toHaveURL(/[?&](?:conversation|agentConversationId)=/);
});

test('does not interrupt an active question with a between-set verification', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the active-question verification boundary.');
  await mockAgentWorkspace(page);
  const verificationId = 'verification-1';
  const verification = {
    schemaVersion: '2', id: verificationId, deliveryId: 'delivery-1', status: 'recommended', phase: 'immediate',
    dueAt: '2026-09-13T08:00:00.000Z', subjectCode: 'math', topicId: 12, topicTitle: '函数平移', questionCount: 3,
    selectionVersion: 'selection-v1', measurementVersion: 'measurement-v1', reasonSummary: '讲解后需要独立新题验证。',
    expiresAt: '2026-09-14T08:00:00.000Z', startedAt: null, completedAt: null, route: null, outcome: null, stability: null
  };
  const routePath = `/csca-subjects/math/practice/rounds/91?agentConversationId=${conversationId}&agentInterventionVerificationId=${verificationId}`;
  await page.route('**/api/v1/agent/intervention-verifications/offer', (route) => json(route, { schemaVersion: '2', item: verification, shortage: null, nextDueAt: null }));
  await page.route(`**/api/v1/agent/intervention-verifications/${verificationId}/start`, (route) => json(route, {
    ...verification, status: 'started', startedAt: '2026-09-13T08:02:00.000Z', route: routePath
  }));
  const verificationRound = (roundId: number) => ({
    session: { id: 61, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: '2026-09-13T08:00:00.000Z', completedAt: null, createdAt: '2026-09-13T08:00:00.000Z', updatedAt: '2026-09-13T08:00:00.000Z' },
    round: { id: roundId, sessionId: 61, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'verification' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: '2026-09-13T08:00:00.000Z', submittedAt: null, version: 1 },
    questions: [{ id: roundId * 10 + 1, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '验证函数平移方向。', options: [{ id: 'A', text: '向右' }, { id: 'B', text: '向左' }], topicId: 12, topicCode: 'function-shift', topicTitle: '函数平移', position: 1 }]
  });
  await page.route(/\/api\/v1\/csca-special-practice\/adaptive\/rounds\/(81|91)(?:\?.*)?$/, (route) => {
    const roundId = Number(new URL(route.request().url()).pathname.split('/').pop());
    return json(route, verificationRound(roundId));
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByRole('button', { name: '开始验证' })).toHaveCount(0);
  await expect(page).not.toHaveURL(/agentInterventionVerificationId=/);
});

test('hydrates an interrupted teaching workspace by delivery id when continuing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the teaching resume contract.');
  await mockAgentWorkspace(page);
  const deliveryId = 'delivery-resume-1';
  const activeWorkspace = { kind: 'teaching', conversationId, deliveryId };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, {
    ...journeyState,
    activeWorkspace,
    stages: [{
      ...journeyState.stages[0], id: `teaching:${deliveryId}`, kind: 'teaching', journeyId: deliveryId,
      title: '看懂函数的水平平移', taskType: 'concept_learning', status: 'active', completedAt: null,
      metrics: { ...journeyState.stages[0].metrics, allocatedQuestionCount: 0, answeredQuestionCount: 0 }, resume: activeWorkspace
    }]
  }));
  const teachingAsset = {
    id: 'asset-resume-1', stableKey: 'math-function-shift-resume', type: 'interactive_visualizer', subjectCode: 'math',
    versionId: 'asset-version-resume-1', version: 1, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 4,
    renderer: 'interactive_component', payloadSchemaVersion: '1', resolverVersion: 'teaching-asset-resolver-v2', topicTitle: '函数平移',
    title: '看懂函数的水平平移', summary: '拖动参数，观察顶点如何移动。', instructions: ['拖动水平参数 h。'],
    component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 2 } },
    activePrompt: { id: 'prompt-resume-1', prompt: 'y=(x-2)² 如何移动？', options: [{ id: 'right', label: '向右平移 2' }, { id: 'left', label: '向左平移 2' }] },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }, fallback: {}, sourceRefs: [], reviewState: 'published', publishedAt: '2026-09-12T00:00:00.000Z'
  };
  const delivery = {
    schemaVersion: '1', id: deliveryId, interventionId: 'intervention-resume-1', status: 'in_progress', placement: 'between_sets',
    subjectCode: 'math', topicId: 12, action: 'concept_learning', urgency: 'medium', reasonSummary: '继续完成上次函数平移讲解。', triggerCodes: ['REPEATED_TOPIC_ERROR'],
    content: { sourceType: 'teaching_asset', sourceId: teachingAsset.id, sourceVersion: teachingAsset.versionId, title: teachingAsset.title, body: teachingAsset.summary, example: null, topicTitle: teachingAsset.topicTitle, teachingAsset },
    offeredAt: '2026-09-13T08:02:00.000Z', startedAt: '2026-09-13T08:03:00.000Z', completedAt: null, deferredUntil: null, skippedAt: null, masteryChanged: false
  };
  let directLoads = 0;
  await page.route('**/api/v1/agent/interventions/offer', (route) => json(route, { code: 'LEARNING_INTERVENTION_DELIVERY_DISABLED', message: '学习讲解建议暂未开放。' }, 503));
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}`, (route) => {
    directLoads += 1;
    return json(route, delivery);
  });

  await page.goto(`/agent?conversation=${conversationId}`);
  await page.getByRole('button', { name: '继续知识讲解', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`agentTeachingDeliveryId=${deliveryId}`));
  await expect(page.getByLabel('Agent 知识讲解工作区')).toBeVisible();
  await expect(page.getByLabel('Agent 知识讲解工作区')).toContainText('看懂函数的水平平移');
  expect(directLoads).toBeGreaterThanOrEqual(1);
});

test('retires an interrupted teaching workspace when its content is no longer available', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the stale teaching recovery contract.');
  await mockAgentWorkspace(page);
  const deliveryId = 'delivery-stale-1';
  const activeWorkspace = { kind: 'teaching', conversationId, deliveryId };
  let journeyLoads = 0;
  await page.route('**/api/v1/agent/journey/state', (route) => {
    journeyLoads += 1;
    return json(route, journeyLoads === 1 ? {
      ...journeyState,
      activeWorkspace,
      stages: [{
        ...journeyState.stages[0], id: `teaching:${deliveryId}`, kind: 'teaching', journeyId: deliveryId,
        title: '历史讲解', taskType: 'concept_learning', status: 'active', completedAt: null,
        metrics: { ...journeyState.stages[0].metrics, allocatedQuestionCount: 0, answeredQuestionCount: 0 }, resume: activeWorkspace
      }]
    } : {
      ...journeyState,
      activeWorkspace: null,
      stages: [{
        ...journeyState.stages[0], id: `teaching:${deliveryId}`, kind: 'teaching', journeyId: deliveryId,
        title: '历史讲解（内容已失效）', taskType: 'concept_learning', status: 'content_unavailable', completedAt: null,
        metrics: { ...journeyState.stages[0].metrics, allocatedQuestionCount: 0, answeredQuestionCount: 0 }, resume: null
      }]
    });
  });
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}`, (route) => json(route, {
    statusCode: 404,
    errorCode: 'NOT_FOUND',
    message: '学习讲解建议不存在。'
  }, 404));

  await page.goto(`/agent?conversation=${conversationId}`);
  await page.getByRole('button', { name: '继续知识讲解', exact: true }).click();

  await expect(page).toHaveURL(/\/zh\/agent$/);
  await expect(page.getByRole('button', { name: '继续知识讲解', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('上次讲解内容已失效，已返回当前可开始的学习任务。');
  await expect(page.getByLabel('Agent 知识讲解工作区')).toHaveCount(0);
  expect(journeyLoads).toBeGreaterThanOrEqual(2);
});

test('retires a teaching workspace whose delivery is already terminal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the terminal teaching recovery contract.');
  await mockAgentWorkspace(page);
  const deliveryId = 'delivery-completed-1';
  const activeWorkspace = { kind: 'teaching', conversationId, deliveryId };
  let journeyLoads = 0;
  await page.route('**/api/v1/agent/journey/state', (route) => {
    journeyLoads += 1;
    return json(route, journeyLoads === 1 ? {
      ...journeyState,
      activeWorkspace,
      stages: [{ ...journeyState.stages[0], id: `teaching:${deliveryId}`, kind: 'teaching', status: 'active', resume: activeWorkspace }]
    } : { ...journeyState, activeWorkspace: null });
  });
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}`, (route) => json(route, {
    schemaVersion: '1', id: deliveryId, interventionId: 'intervention-completed-1', status: 'completed', placement: 'between_sets',
    subjectCode: 'math', topicId: 12, action: 'concept_learning', urgency: 'medium', reasonSummary: '历史讲解已完成。', triggerCodes: [],
    content: { sourceType: 'concept_card', sourceId: 'card-1', sourceVersion: '1', title: '函数平移', body: '已完成', example: null, topicTitle: '函数平移', teachingAsset: null },
    offeredAt: '2026-09-13T08:00:00.000Z', startedAt: '2026-09-13T08:01:00.000Z', completedAt: '2026-09-13T08:02:00.000Z', deferredUntil: null, skippedAt: null, masteryChanged: false
  }));

  await page.goto(`/agent?conversation=${conversationId}`);
  await page.getByRole('button', { name: '继续知识讲解', exact: true }).click();

  await expect(page).toHaveURL(/\/zh\/agent$/);
  await expect(page.getByRole('button', { name: '继续知识讲解', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText('上次讲解已经结束，已返回当前可开始的学习任务。');
  await expect(page.locator('.agent-intervention-card')).toHaveCount(0);
  expect(journeyLoads).toBeGreaterThanOrEqual(2);
});

test('restores checked answers and wrong counts after the practice view remounts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the restored answer-state contract.');
  await mockAgentWorkspace(page);
  const now = '2026-09-23T08:00:00.000Z';
  const restoredRound = {
    session: { id: 81, userId: 42, subject: 'physics', mode: 'practice', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 181, sessionId: 81, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'practice' }, answers: {}, timeSpent: {}, currentQuestion: 2, correctCount: 0, wrongCount: 0, unansweredCount: 2, startedAt: now, submittedAt: null, version: 2 },
    questions: [
      { id: 1811, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '惯性大小由什么决定？', options: [{ id: 'A', text: '质量' }, { id: 'B', text: '速度' }], topicId: 47, topicCode: 'inertia', topicTitle: '惯性', position: 1, selectedAnswer: 'B', isCorrect: false, correctAnswer: 'A', explanation: '惯性只与质量有关。', knowledgeTags: ['惯性'] },
      { id: 1812, orderNumber: 2, difficulty: 'basic', questionType: 'single-choice', prompt: '匀速运动时合力是多少？', options: [{ id: 'A', text: '0 N' }, { id: 'B', text: '1 N' }], topicId: 48, topicCode: 'force', topicTitle: '力与运动', position: 2, selectedAnswer: null, isCorrect: null }
    ]
  };
  await page.route((url) => url.pathname === '/api/v1/csca-special-practice/adaptive/rounds/181', (route) => {
    if (route.request().method() === 'PATCH') return json(route, restoredRound.round);
    return json(route, restoredRound);
  });

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=181&agentView=practice&agentTaskType=free_practice&agentSubject=physics`);

  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.locator('.special-question-nav summary')).toContainText('1/2 已答 · 正确 0 · 错误 1');
  await page.locator('.special-question-nav summary').click();
  await expect(page.locator('.special-question-nav-grid button').first()).toHaveClass(/wrong/);
});

test('serializes overlapping adaptive round autosaves', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the autosave concurrency contract.');
  await mockAgentWorkspace(page);
  const now = '2026-09-23T08:00:00.000Z';
  let version = 1;
  let activePatches = 0;
  let maxActivePatches = 0;
  const expectedVersions: number[] = [];
  const roundDetail = {
    session: { id: 82, userId: 42, subject: 'physics', mode: 'practice', status: 'active', questionLanguage: 'zh', startedAt: now, completedAt: null, createdAt: now, updatedAt: now },
    round: { id: 182, sessionId: 82, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'practice' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 2, startedAt: now, submittedAt: null, version },
    questions: [
      { id: 1821, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '惯性大小由什么决定？', options: [{ id: 'A', text: '质量' }, { id: 'B', text: '速度' }], topicId: 47, topicCode: 'inertia', topicTitle: '惯性', position: 1 },
      { id: 1822, orderNumber: 2, difficulty: 'basic', questionType: 'single-choice', prompt: '匀速运动时合力是多少？', options: [{ id: 'A', text: '0 N' }, { id: 'B', text: '1 N' }], topicId: 48, topicCode: 'force', topicTitle: '力与运动', position: 2 }
    ]
  };
  await page.route((url) => url.pathname === '/api/v1/csca-special-practice/adaptive/rounds/182', async (route) => {
    if (route.request().method() !== 'PATCH') return json(route, { ...roundDetail, round: { ...roundDetail.round, version } });
    const body = route.request().postDataJSON() as { expectedVersion?: number };
    activePatches += 1;
    maxActivePatches = Math.max(maxActivePatches, activePatches);
    expectedVersions.push(body.expectedVersion ?? -1);
    await new Promise((resolve) => setTimeout(resolve, 900));
    version += 1;
    activePatches -= 1;
    return json(route, { ...roundDetail.round, version });
  });
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/182/check', (route) => {
    const body = route.request().postDataJSON() as { questionId: number; selected: string };
    return json(route, {
      questionId: body.questionId,
      selected: body.selected,
      correctAnswer: 'A',
      isCorrect: body.selected === 'A',
      explanation: '测试解析。',
      knowledgeTags: ['力与运动']
    });
  });

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=182&agentView=practice&agentTaskType=free_practice&agentSubject=physics`);
  const workspace = page.getByLabel('Agent 学习任务工作区');
  await workspace.getByRole('button', { name: 'A 质量', exact: true }).click();
  await page.waitForTimeout(800);
  await workspace.getByRole('button', { name: '下一题', exact: true }).click();
  await expect.poll(() => expectedVersions.length).toBe(2);

  expect(maxActivePatches).toBe(1);
  expect(expectedVersions).toEqual([1, 2]);
});

test('keeps generic teaching interventions out of an active question workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the teaching and practice workspace contract.');
  await mockAgentWorkspace(page);
  const deliveryId = 'delivery-teaching-1';
  let deliveryStatus = 'offered';
  let verificationReady = false;
  let interventionOffers = 0;
  const teachingAsset = {
    id: 'asset-1', stableKey: 'math-function-shift', type: 'interactive_visualizer', subjectCode: 'math',
    versionId: 'asset-version-1', version: 1, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 4,
    renderer: 'interactive_component', payloadSchemaVersion: '1', resolverVersion: 'teaching-asset-resolver-v2', topicTitle: '函数平移',
    title: '看懂函数的水平平移', summary: '拖动参数，观察顶点如何移动。', instructions: ['拖动水平参数 h。', '观察顶点坐标。'],
    component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 2 } },
    activePrompt: { id: 'prompt-1', prompt: 'y=(x-2)² 相比 y=x² 如何移动？', options: [{ id: 'right', label: '向右平移 2' }, { id: 'left', label: '向左平移 2' }] },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }, fallback: {}, sourceRefs: [], reviewState: 'published', publishedAt: '2026-09-12T00:00:00.000Z'
  };
  const delivery = () => ({
    schemaVersion: '1', id: deliveryId, interventionId: 'intervention-1', status: deliveryStatus, placement: 'between_sets',
    subjectCode: 'math', topicId: 12, action: 'concept_learning', urgency: 'medium', reasonSummary: '函数平移连续出现同类错误，建议先用 4 分钟看清参数与方向。',
    triggerCodes: ['REPEATED_TOPIC_ERROR'],
    content: {
      sourceType: 'teaching_asset', sourceId: teachingAsset.id, sourceVersion: teachingAsset.versionId,
      title: '看懂函数的水平平移', body: deliveryStatus === 'in_progress' ? '通过可交互图像理解平移方向。' : '', example: null,
      topicTitle: '函数平移', teachingAsset: deliveryStatus === 'in_progress' ? teachingAsset : null
    },
    offeredAt: '2026-09-13T08:02:00.000Z', startedAt: deliveryStatus === 'in_progress' ? '2026-09-13T08:03:00.000Z' : null,
    completedAt: null, deferredUntil: null, skippedAt: null, masteryChanged: false
  });
  const verification = {
    schemaVersion: '2', id: 'verification-after-teaching', deliveryId, status: 'recommended', phase: 'immediate',
    dueAt: '2026-09-13T08:05:00.000Z', subjectCode: 'math', topicId: 12, topicTitle: '函数平移', questionCount: 2,
    selectionVersion: 'selection-v1', measurementVersion: 'measurement-v1', reasonSummary: '讲解后使用未曝光的新题独立验证。',
    expiresAt: '2026-09-14T08:05:00.000Z', startedAt: null, completedAt: null, route: null, outcome: null, stability: null
  };
  await page.route('**/api/v1/agent/interventions/offer', (route) => {
    interventionOffers += 1;
    return json(route, { schemaVersion: '1', item: delivery(), suppressedReason: null });
  });
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}`, (route) => json(route, delivery()));
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}/actions`, async (route) => {
    const action = String((await route.request().postDataJSON()).action ?? '');
    if (action === 'start') deliveryStatus = 'in_progress';
    if (action === 'complete') { deliveryStatus = 'completed'; verificationReady = true; }
    return json(route, delivery());
  });
  await page.route(`**/api/v1/agent/intervention-deliveries/${deliveryId}/teaching-interactions`, async (route) => {
    const action = String((await route.request().postDataJSON()).action ?? 'opened');
    return json(route, {
      schemaVersion: '1', eventId: `event-${action}`, status: action === 'completed' ? 'completed' : 'recorded', action,
      correct: action === 'active_prompt_answered' ? true : null,
      feedback: action === 'active_prompt_answered' ? '正确，括号内减 2 表示图像向右平移。' : null,
      masteryChanged: false, verificationRequired: action === 'completed'
    });
  });
  await page.route('**/api/v1/agent/intervention-verifications/offer', (route) => json(route, {
    schemaVersion: '2', item: verificationReady ? verification : null, shortage: null, nextDueAt: null
  }));
  const roundNow = '2026-09-15T10:00:00.000Z';
  const teachingRound = {
    session: { id: 51, userId: 42, subject: 'math', mode: 'adaptive', status: 'active', questionLanguage: 'zh', startedAt: roundNow, completedAt: null, createdAt: roundNow, updatedAt: roundNow },
    round: { id: 81, sessionId: 51, roundIndex: 1, status: 'active', plannerSnapshot: { mode: 'diagnostic' }, answers: {}, timeSpent: {}, currentQuestion: 1, correctCount: 0, wrongCount: 0, unansweredCount: 1, startedAt: roundNow, submittedAt: null, version: 1 },
    questions: [{ id: 101, orderNumber: 1, difficulty: 'basic', questionType: 'single-choice', prompt: '函数 y=(x-2)² 的图像如何平移？', options: [{ id: 'A', text: '向右平移 2' }, { id: 'B', text: '向左平移 2' }], topicId: 12, topicCode: 'function-shift', topicTitle: '函数平移', position: 1 }]
  };
  await page.route('**/api/v1/csca-special-practice/adaptive/rounds/81**', (route) => json(route, teachingRound));
  await page.route('**/api/v1/csca-special-practice/adaptive/ai/entitlement', (route) => json(route, { enabled: true, unlimited: false, balanceUnits: 50 }));

  await page.goto(`/agent?agentContextId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.locator('.agent-intervention-card')).toHaveCount(0);
  await expect(page).not.toHaveURL(/agentTeachingDeliveryId=/);
  expect(interventionOffers).toBe(0);
});


test('opens a grounded past paper inside the Agent workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the past-paper workspace contract.');
  await mockAgentWorkspace(page);
  let learningContextCreates = 0;
  let genericConversationCreates = 0;
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname === '/api/v1/agent/conversations') genericConversationCreates += 1;
  });
  await page.route((url) => url.pathname === '/api/v1/agent/learning-contexts', async (route) => {
    learningContextCreates += 1;
    expect(await route.request().postDataJSON()).toEqual({ kind: 'past_paper', resourceId: 'chemistry-2026-01' });
    return json(route, {
      contextId: 'past-paper-context-1', kind: 'past_paper', resourceId: 'chemistry-2026-01', createdAt: '2026-09-16T08:00:00.000Z'
    });
  });
  const pastPaperResource = {
    id: 71, slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', subject: 'chemistry' as const, examYear: 2026,
    language: 'zh', questionCount: 48, pageCount: 18, hasAnswers: true, hasSolutions: true, isFree: true, fileCount: 2
  };
  await page.route((url) => url.pathname === '/api/v1/agent/journey/overview', (route) => json(route, {
    schemaVersion: '1', generatedAt: '2026-09-16T08:00:00.000Z',
    goal: { examDate: '2027-06-01', weeklyGoalDays: 5, totalTargetScore: 255, subjects: [{ subject: 'chemistry', targetScore: 85 }] },
    progress: { subjects: [] },
    weaknesses: { stateSource: 'user_csca_topic_mastery_v1', subjects: [], reviewQueue: [] },
    resources: { source: 'published_past_papers', subjectScope: ['chemistry'], items: [pastPaperResource] }
  }));
  const paperConversation = {
    ...conversation,
    messages: [...conversation.messages, {
      id: 'message-paper', conversationId, role: 'assistant', clientMessageId: null, runId, createdAt: '2026-09-13T08:03:00.000Z',
      content: {
        schemaVersion: '1', text: '找到一份已发布化学真题。',
        pastPaperResources: [pastPaperResource]
      }
    }]
  };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, paperConversation));
  await page.route('**/api/v1/past-papers/chemistry-2026-01**', (route) => json(route, {
    paper: {
      id: 71, slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', category: 'past-paper', subject: 'chemistry',
      examYear: 2026, language: 'zh', description: '已发布真题', questionCount: 48, pageCount: 18, hasAnswers: true, hasSolutions: true,
      isFree: true, isPublished: true, isFeatured: true, sortOrder: 1, downloadCount: 0, fileCount: 2,
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1
    },
    files: [
      { id: 701, kind: 'paper', label: '原卷 PDF', fileUrl: '/uploads/past-papers/chemistry-paper.pdf', mimeType: 'application/pdf', fileSizeBytes: 954368 },
      { id: 702, kind: 'solutions', label: '答案解析 PDF', fileUrl: '/uploads/past-papers/chemistry-solutions.pdf', mimeType: 'application/pdf', fileSizeBytes: 1048576 }
    ]
  }));
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/questions', (route) => json(route, {
    schemaVersion: '1', status: 'ready', reasonCode: null,
    paper: { slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', subject: 'chemistry' },
    source: { label: 'CSCA 2026 年 1 月化学真题原卷', questionCount: 2 },
    questions: [
      { id: 7101, questionNumber: '1', pageNumber: 2, promptPreview: 'Which property is chemical?', canAnswer: true },
      { id: 7102, questionNumber: '2', pageNumber: 3, promptPreview: 'Choose the correct reaction.', canAnswer: true }
    ]
  }));
  const assistanceHistory: Array<Record<string, unknown>> = [];
  const submittedQuestions = new Set<number>();
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/progress', (route) => json(route, {
    schemaVersion: '1', policyVersion: 'past-paper-answer-v1',
    paper: { id: 71, slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', subject: 'chemistry' },
    status: submittedQuestions.size === 2 ? 'completed' : submittedQuestions.size ? 'in_progress' : 'not_started', totalQuestions: 2, answerableQuestions: 2,
    startedCount: submittedQuestions.size, submittedCount: submittedQuestions.size,
    correctCount: submittedQuestions.size, incorrectCount: 0, assistedCount: submittedQuestions.has(7101) ? 1 : 0,
    evidenceCount: submittedQuestions.has(7102) ? 1 : 0, timeSpentSeconds: submittedQuestions.size * 60, completionRate: submittedQuestions.size / 2,
    nextQuestionId: submittedQuestions.has(7101) ? submittedQuestions.has(7102) ? null : 7102 : 7101,
    items: [
      { questionId: 7101, questionNumber: '1', canAnswer: true, attemptId: submittedQuestions.has(7101) ? 'past-paper-attempt-1' : null, status: submittedQuestions.has(7101) ? 'submitted' : 'not_started', outcome: submittedQuestions.has(7101) ? 'correct' : null, usedAssistance: submittedQuestions.has(7101), evidenceStatus: submittedQuestions.has(7101) ? 'not_eligible' : null },
      { questionId: 7102, questionNumber: '2', canAnswer: true, attemptId: submittedQuestions.has(7102) ? 'past-paper-attempt-2' : null, status: submittedQuestions.has(7102) ? 'submitted' : 'not_started', outcome: submittedQuestions.has(7102) ? 'correct' : null, usedAssistance: false, evidenceStatus: submittedQuestions.has(7102) ? 'recorded' : null }
    ]
  }));
  const attemptPayload = (questionId = 7101) => ({
    schemaVersion: '1', policyVersion: 'past-paper-answer-v1',
    attempt: {
      id: `past-paper-attempt-${questionId === 7101 ? 1 : 2}`, status: submittedQuestions.has(questionId) ? 'submitted' : 'in_progress', selectedAnswer: submittedQuestions.has(questionId) ? 'A' : null,
      outcome: submittedQuestions.has(questionId) ? 'correct' : null, startedAt: '2026-09-15T08:00:00.000Z', submittedAt: submittedQuestions.has(questionId) ? '2026-09-15T08:01:00.000Z' : null,
      timeSpentSeconds: submittedQuestions.has(questionId) ? 60 : null, usedAssistance: questionId === 7101 && submittedQuestions.has(questionId), maxAssistanceLevel: questionId === 7101 && submittedQuestions.has(questionId) ? 'A1' : null,
      evidenceStatus: submittedQuestions.has(questionId) ? questionId === 7101 ? 'not_eligible' : 'recorded' : 'pending', evidenceReasonCode: questionId === 7101 && submittedQuestions.has(questionId) ? 'ASSISTANCE_USED' : null, adaptationPending: false
    },
    question: {
      id: questionId, questionNumber: questionId === 7101 ? '1' : '2', pageNumber: questionId === 7101 ? 2 : 3,
      prompt: questionId === 7101 ? 'Which property is chemical?' : 'Choose the correct reaction.',
      options: [{ key: 'A', text: questionId === 7101 ? 'A new substance is formed.' : 'Acid reacts with a base.' }, { key: 'B', text: 'Only the shape changes.' }]
    },
    citation: { paperSlug: 'chemistry-2026-01', paperTitle: 'CSCA 2026 年 1 月化学真题', sourceLabel: 'CSCA 2026 年 1 月化学真题原卷', sourceQuestionId: questionId, questionNumber: questionId === 7101 ? '1' : '2', pageNumber: questionId === 7101 ? 2 : 3 }
  });
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/questions/7101/attempts/start', (route) => json(route, attemptPayload()));
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/questions/7102/attempts/start', (route) => json(route, attemptPayload(7102)));
  await page.route((url) => url.pathname === '/api/v1/agent/past-paper-attempts/past-paper-attempt-1/submit', (route) => {
    submittedQuestions.add(7101);
    return json(route, attemptPayload());
  });
  await page.route((url) => url.pathname === '/api/v1/agent/past-paper-attempts/past-paper-attempt-2/submit', (route) => {
    submittedQuestions.add(7102);
    return json(route, attemptPayload(7102));
  });
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/questions/7101/assistance', async (route) => {
    if (route.request().method() === 'POST') {
      const input = await route.request().postDataJSON();
      const labels: Record<string, string> = {
        clarify_question: '先区分题目的已知条件和目标。',
        recall_concept: '先回忆化学性质与物理性质的定义。',
        next_step_hint: '判断变化过程中是否产生了新物质。',
        check_step: '你的判断方向正确，再检查依据是否来自题目。',
        show_full_solution: '答案：A\n\n该选项描述了生成新物质的变化。'
      };
      assistanceHistory.push({
        toolCallId: `tool-${assistanceHistory.length + 1}`, action: input.action,
        level: input.action === 'recall_concept' ? 'A1' : input.action === 'show_full_solution' ? 'A6' : 'A2',
        content: labels[input.action], generatedByAI: false, createdAt: '2026-09-15T08:00:00.000Z'
      });
    }
    return json(route, {
      schemaVersion: '1', policyVersion: 'past-paper-assistance-v1', questionId: 7101,
      recommendedAction: 'clarify_question', maxAllowedLevel: 'A6', history: assistanceHistory,
      availableActions: [
        { action: 'clarify_question', level: 'A0', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
        { action: 'recall_concept', level: 'A1', enabled: true, reasonCode: null, generatedByAI: false, confirmationRequired: false },
        { action: 'next_step_hint', level: 'A2', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
        { action: 'check_step', level: 'A3', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
        { action: 'show_full_solution', level: 'A6', enabled: submittedQuestions.has(7101), reasonCode: submittedQuestions.has(7101) ? null : 'ANSWER_REQUIRED', generatedByAI: false, confirmationRequired: true }
      ]
    });
  });
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/questions/7102/assistance', (route) => json(route, {
    schemaVersion: '1', policyVersion: 'past-paper-assistance-v1', questionId: 7102,
    recommendedAction: 'clarify_question', maxAllowedLevel: 'A6', history: [],
    availableActions: [
      { action: 'clarify_question', level: 'A0', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
      { action: 'recall_concept', level: 'A1', enabled: true, reasonCode: null, generatedByAI: false, confirmationRequired: false },
      { action: 'next_step_hint', level: 'A2', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
      { action: 'check_step', level: 'A3', enabled: true, reasonCode: null, generatedByAI: true, confirmationRequired: false },
      { action: 'show_full_solution', level: 'A6', enabled: submittedQuestions.has(7102), reasonCode: submittedQuestions.has(7102) ? null : 'ANSWER_REQUIRED', generatedByAI: false, confirmationRequired: true }
    ]
  }));
  await page.route((url) => url.pathname === '/api/v1/agent/past-papers/chemistry-2026-01/review', (route) => json(route, {
    schemaVersion: '1', policyVersion: 'past-paper-review-v1',
    paper: { id: 71, slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', subject: 'chemistry' },
    summary: { submittedCount: 2, correctCount: 2, incorrectCount: 0, accuracy: 100, assistedCount: 1, independentCount: 1, evidenceCount: 1, timeSpentSeconds: 120 },
    focusTopics: [{ topicId: 12, code: 'chemistry.acid-base', title: '酸碱反应', attemptedCount: 2, incorrectCount: 0, assistedCount: 1 }],
    decision: { status: 'ready', prescriptionId: 'rx-review', reasonSummary: 'Review the highest-priority gap.', confidence: 'high', estimatedMinutes: 15, primaryTask: { type: 'review', subject: 'chemistry', topicIds: [12], questionCount: 5, priority: 1 } },
    provenance: { resultSource: 'agent_past_paper_attempts', nextTaskSource: 'learning_prescription', automaticQuestionGenerationInvoked: false }
  }));
  let submittedMessageBody: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/messages(?:\\?.*)?$`), async (route) => {
    submittedMessageBody = await route.request().postDataJSON();
    return json(route, { messageId: 'message-question', runId, status: 'queued', eventsUrl: `/api/v1/agent/runs/${runId}/events` });
  });

  await page.goto('/agent');
  await page.getByRole('button', { name: '学习资料', exact: true }).click();
  await page.getByRole('button', { name: /打开/ }).click();
  await expect(page).toHaveURL(new RegExp('/agent\\?.*agentPastPaper=chemistry-2026-01.*agentContextId=past-paper-context-1'));
  await expect(page).not.toHaveURL(/agentContextId=conversation-1/);
  await expect(page.getByLabel('真题资料详情')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('真题资料详情')).toBeVisible();
  expect(learningContextCreates).toBe(1);
  expect(genericConversationCreates).toBe(0);
  await expect(page.getByTitle('CSCA 2026 年 1 月化学真题 · 原卷 PDF')).toHaveAttribute('src', /chemistry-paper\.pdf.*#page=2/);
  await expect(page.getByRole('button', { name: /查看完整解析/ })).toBeDisabled();
  await page.getByRole('button', { name: /回忆相关概念/ }).click();
  await expect(page.getByText('先回忆化学性质与物理性质的定义。')).toBeVisible();
  await page.getByRole('button', { name: /A A new substance is formed/ }).click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('回答正确')).toBeVisible();
  await expect(page.getByText(/使用过辅助/)).toBeVisible();
  await expect(page.getByLabel('作答进度').getByText('1/2')).toBeVisible();
  await expect(page.getByRole('button', { name: /继续下一题/ })).toBeVisible();
  await page.getByRole('button', { name: /查看完整解析/ }).click();
  await expect(page.getByText(/完整解析会暴露答案/)).toBeVisible();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText(/答案：A/)).toBeVisible();
  await page.getByRole('button', { name: /继续下一题/ }).click();
  await expect(page.getByTitle('CSCA 2026 年 1 月化学真题 · 原卷 PDF')).toHaveAttribute('src', /chemistry-paper\.pdf.*#page=3/);
  await page.getByRole('button', { name: /A Acid reacts with a base/ }).click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByLabel('作答进度').getByText('2/2')).toBeVisible();
  await expect(page.getByLabel('整卷复盘')).toContainText('100%');
  await expect(page.getByText(/优先巩固.*酸碱反应/)).toBeVisible();
  await page.getByRole('button', { name: /返回做题/ }).click();
  await expect(page.getByRole('button', { name: '做题', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(submittedMessageBody).toBeNull();
});
