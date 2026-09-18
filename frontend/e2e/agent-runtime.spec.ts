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

async function mockNewConversationFlow(page: Page, options: { failFirstStream?: boolean } = {}) {
  let created = false;
  let submittedText = '';
  let streamCursor = '';
  let streamAttempts = 0;
  await page.addInitScript(() => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.localeSource', 'manual');
    window.localStorage.setItem('cscalite.accessToken', 'agent-ui-token');
  });
  await page.route('**/api/v1/auth/me**', (route) => json(route, {
    id: '42', email: 'student@example.com', role: 'student', displayName: '林澈', emailVerifiedAt: '2026-09-01T00:00:00.000Z'
  }));
  await page.route('**/api/v1/agent/**', (route) => json(route, { item: null, items: [] }));
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, journeyState));
  await page.route(/\/api\/v1\/agent\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      created = true;
      return json(route, { ...conversation, messages: undefined, artifacts: undefined });
    }
    return json(route, created ? [conversation] : []);
  });
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, conversation));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/attachments(?:\\?.*)?$`), (route) => json(route, attachmentList));
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/messages(?:\\?.*)?$`), async (route) => {
    submittedText = String((await route.request().postDataJSON()).text ?? '');
    return json(route, { messageId: 'message-1', runId, status: 'queued', eventsUrl: `/api/v1/agent/runs/${runId}/events` });
  });
  await page.route(new RegExp(`/api/v1/agent/runs/${runId}/events(?:\\?.*)?$`), (route) => {
    streamAttempts += 1;
    streamCursor = route.request().headers()['last-event-id'] ?? '';
    if (options.failFirstStream && streamAttempts === 1) {
      return route.fulfill({ status: 503, contentType: 'text/plain', body: 'temporary stream outage' });
    }
    const event = { eventId: 'event-1', runId, conversationId, sequence: 1, type: 'run.completed', createdAt: '2026-09-13T08:01:00.000Z', data: {} };
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `id: 1\ndata: ${JSON.stringify(event)}\n\n` });
  });
  await page.route(new RegExp(`/api/v1/agent/runs/${runId}(?:\\?.*)?$`), (route) => json(route, {
    id: runId, conversationId, userId: 42, status: 'completed', channel: 'web', traceId: 'trace-1',
    startedAt: '2026-09-13T08:00:00.000Z', completedAt: '2026-09-13T08:01:00.000Z', errorCode: null, errorRetryable: null,
    artifacts: [artifact], toolCalls: []
  }));
  return { submittedText: () => submittedText, streamCursor: () => streamCursor, streamAttempts: () => streamAttempts };
}

test('renders an evidence-based learning workspace without horizontal overflow', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '今天的学习方案' })).toBeVisible();
  await expect(page.getByRole('article', { name: '今日学习方案' })).toBeVisible();
  await expect(page.getByRole('button', { name: /开始这项任务/ })).toBeEnabled();
  if (testInfo.project.name !== 'mobile') {
    await expect(page.getByRole('heading', { name: '方案为什么这样安排' })).toBeVisible();
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

test('recovers the Agent workspace automatically after a transient backend outage', async ({ page }) => {
  await mockAgentWorkspace(page);
  let conversationListAttempts = 0;
  await page.route(/\/api\/v1\/agent\/conversations(?:\?.*)?$/, (route) => {
    if (route.request().method() === 'GET' && conversationListAttempts++ === 0) {
      return route.abort('connectionrefused');
    }
    return json(route, [conversation]);
  });

  await page.goto('/zh/agent');
  await expect(page.getByText('学习服务暂时未连接，恢复后会自动继续。')).toBeVisible();
  await expect(page.getByRole('article', { name: '今日学习方案' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('学习服务暂时未连接，恢复后会自动继续。')).toHaveCount(0);
  expect(conversationListAttempts).toBeGreaterThanOrEqual(2);
});

test('keeps the latest Agent message anchored directly above the composer', async ({ page }) => {
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

  await page.goto('/zh/agent');
  await expect(page.getByText('第 24 条学习消息：用于确认长会话恢复后始终展示最新内容。')).toBeVisible();
  await expect.poll(() => page.locator('.agent-thread-scroll').evaluate((element) => ({
    distanceFromBottom: element.scrollHeight - element.scrollTop - element.clientHeight,
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY
  }))).toMatchObject({ distanceFromBottom: 0 });

  const positions = await page.evaluate(() => {
    const scroller = document.querySelector('.agent-thread-scroll')!.getBoundingClientRect();
    const latestMessages = document.querySelectorAll('.agent-message-list > .agent-message-block');
    const latest = latestMessages[latestMessages.length - 1]!.getBoundingClientRect();
    const composer = document.querySelector('.agent-composer')!.getBoundingClientRect();
    return { latestBottom: latest.bottom, scrollerBottom: scroller.bottom, composerTop: composer.top };
  });
  expect(positions.latestBottom).toBeLessThanOrEqual(positions.scrollerBottom + 1);
  expect(positions.scrollerBottom).toBeLessThanOrEqual(positions.composerTop + 1);
});

test('keeps journey navigation, thread, plan action, and composer usable on each viewport', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  for (const locator of [
    page.getByRole('button', { name: '下一步', exact: true }),
    page.getByRole('button', { name: /开始这项任务/ }),
    page.getByLabel('向学习 Agent 提问'),
    page.getByRole('button', { name: '发送' })
  ]) {
    const box = await locator.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
  }
  await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();
  await expect(page.locator('.agent-attach-button')).toBeEnabled();
  await expect(page.locator('.agent-file-input')).toBeHidden();
  await expect(page.getByRole('button', { name: '新建学习对话' })).toHaveCount(0);
  const composer = await page.locator('.agent-composer').boundingBox();
  const viewport = page.viewportSize();
  expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
});

test('falls back to a temporary free-practice entry when the recommended task lacks supply', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the supply fallback contract.');
  await mockAgentWorkspace(page);
  const shortageArtifact = {
    ...artifact,
    snapshot: { ...artifact.snapshot, canStart: false },
    route: null
  };
  const shortageConversation = { ...conversation, artifacts: [shortageArtifact] };
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, shortageConversation));
  await page.goto(`/zh/agent?conversation=${conversationId}`);
  const fallback = page.getByRole('button', { name: /改做自由练习/ });
  await expect(fallback).toBeEnabled();
  await fallback.click();
  await expect(page.getByRole('heading', { name: '你决定现在练什么、练多少' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始自由练习' })).toBeEnabled();
  await expect(page.getByText('只调整本次学习，不会修改你在学习设置中的默认模式。')).toBeVisible();
});

test('renders the server-owned learning journey instead of rebuilding it from conversations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the journey read-model contract.');
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '学习历程', exact: true }).click();
  await expect(page.getByRole('button', { name: /数学短诊断/ })).toContainText('5 题');
  await expect(page.getByRole('button', { name: /数学短诊断/ })).toContainText('80%');
  await expect(page.getByRole('button', { name: /数学短诊断/ })).toContainText('1 次辅助');
});

test('restores an active verification without an artifact or saved browser URL', async ({ page }, testInfo) => {
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
  await page.goto('/zh/agent');
  await expect(page).toHaveURL(new RegExp('/zh/agent\\?.*agentRoundId=81'));
  await expect(page).toHaveURL(new RegExp('agentInterventionVerificationId=verification-1'));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByText('阶段验证 · 数学')).toBeVisible();
  await expect(page.getByLabel('向学习 Agent 提问')).toBeVisible();
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
  await page.goto(`/zh/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=107&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区')).toHaveCount(0);
  await expect(page).not.toHaveURL(/agentRoundId=107/);
  await page.waitForTimeout(800);
  expect(roundRequests).toBeLessThanOrEqual(2);
  expect(entitlementRequests).toBeLessThanOrEqual(2);
});

test('resumes an unfinished stage selected from learning history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the history resume contract.');
  await mockAgentWorkspace(page);
  const resume = {
    kind: 'adaptive_round', conversationId, artifactId, roundId: 81,
    phase: 'practice', taskType: 'diagnostic', subject: 'math'
  };
  await page.route('**/api/v1/agent/journey/state', (route) => json(route, {
    ...journeyState,
    activeWorkspace: resume,
    stages: journeyState.stages.map((stage) => ({ ...stage, status: 'active', completedAt: null, resume }))
  }));
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));
  await page.goto(`/zh/agent?conversation=${conversationId}`);
  await page.getByRole('button', { name: '学习历程', exact: true }).click();
  await page.getByRole('button', { name: /数学短诊断/ }).click();
  await expect(page).toHaveURL(new RegExp('agentRoundId=81'));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByLabel('向学习 Agent 提问')).toBeVisible();
});

test('starts student-initiated free practice without turning it into a recommended plan', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.addInitScript(() => window.localStorage.setItem('moodlelike.agent.learningMode', 'free'));
  let requestBody: Record<string, unknown> | null = null;
  let freeStarted = false;
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
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}(?:\\?.*)?$`), (route) => json(route, {
    ...conversation,
    artifacts: freeStarted ? [artifact, freeArtifact] : [artifact]
  }));
  await page.route('**/api/v1/agent/free-practice/start', async (route) => {
    requestBody = await route.request().postDataJSON();
    freeStarted = true;
    return json(route, {
      schemaVersion: '1', artifactId: 'free-task-1', conversationId,
      sessionId: 31, roundId: 41, mode: 'practice', questionCount: 3,
      subject: 'physics', questionLanguage: 'zh', toolName: 'start_student_initiated_practice', taskType: 'free_practice',
      route: '/agent', legacyRoute: '/csca-subjects/physics/practice/rounds/41',
      workspace: { kind: 'adaptive_round', phase: 'practice', taskType: 'free_practice', subject: 'physics', reasonCodes: ['student_initiated'], objective: null }
    });
  });
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));
  await page.goto('/zh/agent');
  await expect(page.getByRole('heading', { name: '你决定现在练什么、练多少' })).toBeVisible();
  await page.getByRole('button', { name: '物理', exact: true }).click();
  await page.getByRole('button', { name: '3 题', exact: true }).click();
  await page.getByRole('button', { name: '开始自由练习', exact: true }).click();
  await expect.poll(() => requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({ conversationId, subject: 'physics', questionCount: 3, questionLanguage: 'zh' });
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
});

test('treats internal conversations as learning-history stages instead of new chats', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: /学习历程/ }).click();
  await expect(page.getByLabel('已保存的学习阶段')).toBeVisible();
  await expect(page.getByRole('button', { name: /数学短诊断/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '学习历程' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.journeySection'))).toBe('history');
});

test('separates learning settings from account settings and restores the workspace layout', async ({ page }, testInfo) => {
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await expect(page.getByLabel('Agent 学习设置工作区')).toBeVisible();
  await expect(page.getByRole('heading', { name: '你希望 Agent 默认怎样开始' })).toBeVisible();
  await page.locator('.agent-settings-learning-mode').getByRole('button', { name: /自由练习/ }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.learningMode'))).toBe('free');
  await page.getByRole('button', { name: '学习画像', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学习画像' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.journeySection'))).toBe('settings');

  if (testInfo.project.name === 'mobile') {
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Agent 学习设置工作区')).toHaveCount(0);
    await expect(page.getByLabel('向学习 Agent 提问')).toBeFocused();
  } else {
    const separator = page.getByRole('separator', { name: '调整任务面板宽度' });
    await separator.press('ArrowLeft');
    expect(Number(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.taskRailWidth')))).toBeGreaterThan(460);
    await page.getByRole('button', { name: '将任务移到中间' }).click();
    expect(await page.evaluate(() => window.localStorage.getItem('moodlelike.agent.taskRailPosition'))).toBe('center');

    await page.reload();
    await expect(page.getByLabel('Agent 学习设置工作区')).toBeVisible();
    await expect(page.locator('.agent-workspace')).toHaveClass(/is-task-first/);
    await page.getByRole('button', { name: '关闭任务面板' }).click();
    await expect(page.getByLabel('Agent 学习设置工作区')).toHaveCount(0);
    await expect(page.getByLabel('向学习 Agent 提问')).toBeFocused();
    await page.getByRole('button', { name: '学习设置', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Agent 学习设置工作区')).toHaveCount(0);
    await expect(page.getByLabel('向学习 Agent 提问')).toBeFocused();
    await expect(page.getByRole('button', { name: '个人设置', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '个人设置', exact: true }).click();
    await expect(page).toHaveURL(/\/zh\/me\?section=settings$/);
    await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();
    await expect(page.locator('.standalone-account-card.profile')).toContainText('林澈');
  }
});

test('keeps CSCALite organization and credit controls out of the independent account page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Independent account boundary coverage only needs one browser viewport.');
  await mockAgentWorkspace(page);
  let creditRequestCount = 0;
  await page.route('**/api/v1/me/ai-credits', (route) => {
    creditRequestCount += 1;
    return json(route, { balanceUnits: 50 });
  });

  await page.goto('/zh/me?section=settings');
  await expect(page.getByRole('heading', { name: '账号设置' })).toBeVisible();
  await expect(page.getByText('机构与 AI 额度', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '加入机构', exact: true })).toHaveCount(0);
  expect(creditRequestCount).toBe(0);
});

test('renders the saved learning plan as an Agent-native data view', async ({ page }) => {
  await mockAgentWorkspace(page);
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '学习计划' }).click();
  const plan = page.getByLabel('当前学习计划');
  await expect(plan).toBeVisible();
  await expect(plan).toContainText('今日数学优先任务');
  await expect(plan).toContainText('短诊断');
  await expect(plan).toContainText('数学');
  await expect(plan).toContainText('18 min');
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

  await page.goto(`/zh/agent?conversation=${conversationId}&agentPastPaper=retry-paper`);
  await expect(page.getByText('真题服务暂时不可用')).toBeVisible();
  await page.getByRole('button', { name: '重试加载' }).click();
  await expect(page.getByLabel('Agent 真题工作区')).toContainText('恢复测试真题');
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?.*agentPastPaper=retry-paper`));
  expect(detailRequests).toBe(2);
});

test('keeps learning settings open when a versioned save conflicts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the version-conflict contract.');
  await mockAgentWorkspace(page);
  await page.route('**/api/v1/me/agent-study-availability', (route) => json(route, {
    statusCode: 409, code: 'VERSION_CONFLICT', message: '学习时间设置已被其他会话更新'
  }, 409));

  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '学习设置', exact: true }).click();
  await page.getByRole('button', { name: '学习时间', exact: true }).click();
  await page.getByLabel('默认单次时长').fill('45');
  await page.getByRole('button', { name: '保存学习时间', exact: true }).click();
  await expect(page.locator('.agent-settings-status')).toContainText('学习时间暂时无法保存，请刷新后重试');
  await expect(page.getByLabel('Agent 学习设置工作区')).toBeVisible();
  await expect(page.getByLabel('向学习 Agent 提问')).toBeVisible();
});

test('submits the recommended prompt and consumes the resumable event stream', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the request/SSE contract.');
  const observed = await mockNewConversationFlow(page);
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '我今天该学什么？' }).click();
  await expect(page.getByRole('article', { name: '今日学习方案' })).toBeVisible();
  expect(observed.submittedText()).toBe('我今天该学什么？');
  expect(observed.streamCursor()).toBe('0');
});

test('announces an interrupted run and reconnects the resumable event stream', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the SSE recovery contract.');
  const observed = await mockNewConversationFlow(page, { failFirstStream: true });
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '我今天该学什么？' }).click();
  await expect(page.getByRole('status')).toContainText('连接中断，正在恢复');
  await expect.poll(observed.streamAttempts).toBe(2);
  await expect(page.getByRole('status')).toContainText('学习数据已连接');
  await expect(page.getByRole('article', { name: '今日学习方案' })).toBeVisible();
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
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));
  await page.goto('/zh/agent');
  await page.getByRole('button', { name: /开始这项任务/ }).click();
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?.*agentRoundId=81`));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByText('短诊断 · 数学')).toBeVisible();
  await expect(page.getByLabel('Agent 学习任务工作区').getByText('先完成一次短诊断，再根据结果调整训练。')).toBeVisible();
  expect(requestBody?.questionLanguage).toBe('zh');
  expect(typeof requestBody?.clientRequestId).toBe('string');
});

test('binds the active practice question to the composer and renders assistance in the chat', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the contextual assistance contract.');
  await mockAgentWorkspace(page);
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
  await page.goto(`/zh/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('当前练习题上下文')).toContainText('当前第 1/1 题');
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-panel')).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-assistance-bridge')).toBeVisible();
  await page.getByLabel('当前练习题上下文').getByRole('button', { name: '回忆知识点' }).click();
  await expect(page.locator('.agent-practice-assistance-message')).toContainText('一次函数 y=kx+b 中，k 表示斜率。');
  expect(requestedAction).toBe('recall_concept');
  await page.getByLabel('Agent 学习任务工作区').getByRole('button', { name: 'A 1', exact: true }).click();
  await expect(page.getByLabel('当前题知识讲解')).toContainText('把讲解留在聊天区，题目保持不动');
  await expect(page.getByLabel('Agent 学习任务工作区').locator('.agent-micro-lesson-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.agent-practice-assistance-message')).toContainText('一次函数 y=kx+b 中，k 表示斜率。');
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
  const submittedAttempt = { ...attempt, submittedAt: '2026-09-15T08:30:00.000Z', answers: { '101': 'A' }, version: 2 };
  const report = {
    attempt: submittedAttempt,
    summary: { score: 100, correctCount: 1, wrongCount: 0, unansweredCount: 0, total: 1, totalSeconds: 30, averageSeconds: 30 },
    knowledgeStats: [{ tag: '一次函数', total: 1, wrong: 0 }],
    items: [{ id: 101, orderNumber: 1, questionType: 'single-choice', prompt: '函数 y=2x+1 与 y 轴交于哪一点？', options: [{ id: 'A', text: '(0, 1)' }, { id: 'B', text: '(1, 0)' }], selected: 'A', correctAnswer: 'A', isCorrect: true, isUnanswered: false, isMarked: false, explanation: '令 x=0。', knowledgeTags: ['一次函数'], secondsSpent: 30 }]
  };
  await page.route('**/api/v1/csca-mock-exam/attempts/901/submit', (route) => json(route, report));
  await page.route('**/api/v1/csca-mock-exam/attempts/901/report**', (route) => json(route, report));
  let settlementCalled = false;
  await page.route('**/api/v1/agent/mock-exam-attempts/901/settle', (route) => {
    settlementCalled = true;
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

  await page.goto('/zh/agent');
  await page.getByRole('button', { name: /开始这项任务/ }).click();
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?.*agentMockExamAttemptId=901`));
  await expect(page.getByLabel('Agent 在线模考工作区')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Agent 在线模考工作区')).toBeVisible();
  await expect(page.getByText('专注考试模式')).toBeVisible();
  await expect(page.getByText('函数 y=2x+1 与 y 轴交于哪一点？')).toBeVisible();
  await expect(page.locator('.site-header')).toHaveCount(0);
  await page.getByRole('button', { name: /\(0, 1\)/ }).click();
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.getByRole('button', { name: '确认交卷', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?.*agentView=mock-report`));
  await expect(page.getByText('模考报告与下一步')).toBeVisible();
  await expect(page.getByText('学习证据已更新')).toBeVisible();
  await expect(page.getByText('本次已接收 1 条可信答题证据')).toBeVisible();
  await expect(page.getByText('下一步优先稳定函数应用。')).toBeVisible();
  await expect(page.getByText('卷面分数来自本次已提交模考；这里不展示未经校准的能力分预测。')).toBeVisible();
  await expect(page.getByText('模考成绩报告')).toBeVisible();
  await expect(page.getByRole('button', { name: /返回套卷列表/ })).toHaveCount(0);
  expect(settlementCalled).toBe(true);
  await page.reload();
  await expect(page.getByText('模考报告与下一步')).toBeVisible();
  await page.getByRole('button', { name: '生成并查看下一项任务' }).click();
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?conversation=${conversationId}$`));
  await expect(page.getByText('模考后的数学巩固任务')).toBeVisible();
  await expect(page.getByText('先完成一次函数针对性练习，再观察稳定性。')).toBeVisible();
  expect(continuationBody?.pageContext?.entityRef).toEqual({ type: 'mock_attempt', id: '901' });
  expect(continuationBody?.text).toContain('模考安排下一步');
});

test('opens an intervention verification inside the Agent workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the verification workspace contract.');
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
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));

  await page.goto('/zh/agent');
  await page.getByRole('button', { name: '开始验证' }).click();
  await expect(page).toHaveURL(new RegExp(`/zh/agent\\?.*agentInterventionVerificationId=${verificationId}`));
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByText('在 Agent 内完成练习')).toBeVisible();
});

test('keeps active practice mounted while a teaching lesson opens in chat', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the teaching and practice workspace contract.');
  await mockAgentWorkspace(page);
  const deliveryId = 'delivery-teaching-1';
  let deliveryStatus = 'offered';
  let verificationReady = false;
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
  await page.route('**/api/v1/agent/interventions/offer', (route) => json(route, { schemaVersion: '1', item: delivery(), suppressedReason: null }));
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
  await page.route('**/api/v1/csca-special-practice/**', (route) => json(route, { message: 'mock round intentionally unavailable' }, 503));

  await page.goto(`/zh/agent?conversation=${conversationId}&agentConversationId=${conversationId}&agentArtifactId=${artifactId}&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math`);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.locator('.agent-intervention-card')).toContainText('函数平移连续出现同类错误');
  await page.getByRole('button', { name: '开始学习' }).click();
  await expect(page).toHaveURL(new RegExp(`agentTeachingDeliveryId=${deliveryId}`));
  await expect(page).toHaveURL(/agentRoundId=81/);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByLabel('聊天区知识讲解')).toBeVisible();
  await expect(page.getByLabel('Agent 知识讲解工作区')).toHaveCount(0);
  await expect(page.locator('.agent-intervention-card')).toContainText('继续学习');

  await page.reload();
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByLabel('聊天区知识讲解')).toBeVisible();
  await page.getByRole('button', { name: '开始讲解' }).click();
  await page.getByRole('radio', { name: '向右平移 2' }).check();
  await page.getByRole('button', { name: '检查我的判断' }).click();
  await expect(page.getByText('正确，括号内减 2 表示图像向右平移。')).toBeVisible();
  await page.getByRole('button', { name: '我理解了，完成微课' }).click();
  await expect(page.getByLabel('聊天区知识讲解')).toHaveCount(0);
  await expect(page.getByLabel('Agent 学习任务工作区')).toBeVisible();
  await expect(page.getByRole('button', { name: /开始验证/ })).toBeVisible();
});


test('opens a grounded past paper inside the Agent workspace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser project is enough for the past-paper workspace contract.');
  await mockAgentWorkspace(page);
  const paperConversation = {
    ...conversation,
    messages: [...conversation.messages, {
      id: 'message-paper', conversationId, role: 'assistant', clientMessageId: null, runId, createdAt: '2026-09-13T08:03:00.000Z',
      content: {
        schemaVersion: '1', text: '找到一份已发布化学真题。',
        pastPaperResources: [{
          id: 71, slug: 'chemistry-2026-01', title: 'CSCA 2026 年 1 月化学真题', subject: 'chemistry', examYear: 2026,
          language: 'zh', questionCount: 48, pageCount: 18, hasAnswers: true, hasSolutions: true, isFree: true, fileCount: 2
        }]
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
  let submittedPageContext: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/api/v1/agent/conversations/${conversationId}/messages(?:\\?.*)?$`), async (route) => {
    submittedPageContext = (await route.request().postDataJSON()).pageContext ?? null;
    return json(route, { messageId: 'message-question', runId, status: 'queued', eventsUrl: `/api/v1/agent/runs/${runId}/events` });
  });

  await page.goto('/zh/agent');
  await page.getByRole('button', { name: /在 Agent 内打开/ }).click();
  await expect(page).toHaveURL(new RegExp('/zh/agent\\?.*agentPastPaper=chemistry-2026-01'));
  await expect(page.getByLabel('Agent 真题工作区')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Agent 真题工作区')).toBeVisible();
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
  await page.getByRole('button', { name: /让 Agent 安排下一步/ }).click();
  await expect(page.getByLabel('向学习 Agent 提问')).toHaveValue(/接下来学什么/);
  await page.getByRole('button', { name: '发送' }).click();
  await expect.poll(() => submittedPageContext).toMatchObject({
    entityRef: { type: 'past_paper', id: 'chemistry-2026-01' },
    selectedQuestionId: 7102
  });
});
