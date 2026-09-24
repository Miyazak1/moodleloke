const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const root = path.resolve(__dirname, '..');
const credentialsPath = path.join(root, '.local', 'agent-demo-credentials.json');
const scenarioPath = path.join(root, '.local', 'agent-teaching-browser-demo.json');
const marker = 'LOCAL_DEMO_ONLY_AGENT_TEACHING_BROWSER';
const demoEmail = 'agent-investor-demo@moodlelike.local';

loadEnv();
const prisma = new PrismaClient();

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertLocalWrite() {
  assert(process.argv.includes('--apply'), 'Refusing to write without --apply.');
  assert(process.env.NODE_ENV !== 'production' && process.env.MOODLELIKE_ENV !== 'production' && process.env.CSC_ENV !== 'production', 'Agent teaching browser demo is disabled in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname), `Demo preparation only accepts a local database, received ${databaseUrl.hostname || 'unset'}.`);
}

function resetBaseline() {
  if (process.argv.includes('--keep-baseline')) return;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'agent-demo-seed.cjs'), '--apply'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
  assert(result.status === 0, `Agent demo baseline failed with exit code ${result.status ?? 'unknown'}.`);
}

async function main() {
  assertLocalWrite();
  resetBaseline();

  const user = await prisma.user.findUnique({ where: { email: demoEmail } });
  assert(user, 'The isolated Agent demo account is missing after baseline reset.');
  assert(fs.existsSync(credentialsPath), 'The isolated Agent demo credential file is missing.');

  const topic = await prisma.cscaExamTopic.findUnique({ where: { code: 'M-CALC-001' } });
  assert(topic?.status === 'published', 'Published topic M-CALC-001 is required for the browser teaching demo.');
  const asset = await prisma.teachingAsset.findUnique({
    where: { stableKey: 'math.function-horizontal-shift' },
    include: { versions: { where: { status: 'published', language: 'zh-CN' } }, topics: true }
  });
  assert(asset?.status === 'published' && asset.versions.length > 0, 'Published math.function-horizontal-shift TeachingAsset is required.');
  assert(asset.topics.some((item) => item.topicId === topic.id && item.relationship === 'primary'), 'The teaching asset is not bound to M-CALC-001.');

  // Keep the demo repeatable without weakening the production no-repeat rule.
  // This account is isolated and these questions only exist for the local Agent demo.
  const demoQuestionIds = (await prisma.cscaQuestion.findMany({
    where: { sourceType: 'agent_local_demo_practice', topicId: topic.id },
    select: { id: true }
  })).map((item) => item.id);
  const demoEvidenceQuestionIds = demoQuestionIds.map((id) => `csca_question:${id}`);
  if (demoQuestionIds.length > 0) {
    await prisma.assessmentItemExposure.deleteMany({
      where: { userId: user.id, itemType: 'csca_question', itemId: { in: demoQuestionIds.map(String) } }
    });
  }
  if (demoEvidenceQuestionIds.length > 0) {
    await prisma.learningEvidenceEvent.deleteMany({
      where: { userId: user.id, questionId: { in: demoEvidenceQuestionIds } }
    });
  }
  await prisma.userCscaTopicStateV2.deleteMany({
    where: { userId: user.id, subjectCode: 'math', topicId: topic.id }
  });
  await prisma.learningStateProjectionCheckpoint.deleteMany({
    where: { userId: user.id, subjectCode: 'math' }
  });

  await prisma.learningIntervention.deleteMany({ where: { userId: user.id } });
  await prisma.teachingInteractionEvent.deleteMany({ where: { userId: user.id } });
  await prisma.teachingAssetExposure.deleteMany({ where: { userId: user.id } });
  await prisma.cscaWrongPattern.deleteMany({ where: { userId: user.id, patternType: 'demo_agent_teaching_repeated_misconception' } });

  const wrongPattern = await prisma.cscaWrongPattern.create({
    data: {
      userId: user.id,
      subject: 'math',
      topicId: topic.id,
      patternType: 'demo_agent_teaching_repeated_misconception',
      recurrenceCount: 4,
      lastWrongAt: new Date(),
      nextReviewAt: new Date(),
      status: 'active',
      metadata: { marker, scenario: 'repeated_horizontal_shift_direction_error', localDemoOnly: true }
    }
  });
  const mastery = await prisma.userCscaTopicMastery.upsert({
    where: { userId_topicId: { userId: user.id, topicId: topic.id } },
    update: { subject: 'math', mastery: 0.42, confidence: 0.84, attemptCount: 8, correctCount: 3, lastPracticedAt: new Date() },
    create: { userId: user.id, subject: 'math', topicId: topic.id, mastery: 0.42, confidence: 0.84, attemptCount: 8, correctCount: 3, lastPracticedAt: new Date() }
  });

  const now = new Date();
  const conversation = await prisma.agentConversation.create({
    data: {
      userId: user.id,
      status: 'active',
      title: '函数平移 · 教学闭环演示',
      lastMessageAt: now,
      messages: {
        create: [
          {
            role: 'user',
            clientMessageId: `demo-teaching-${randomUUID()}`,
            content: { schemaVersion: '1', text: '为什么函数平移的方向我总是判断错？', demo: { marker, localDemoOnly: true } },
            createdAt: new Date(now.getTime() - 1000)
          },
          {
            role: 'assistant',
            content: {
              schemaVersion: '1',
              text: '我会先依据你已经发生的重复错误，推荐一项短讲解；完成讲解后还要用未曝光的新题独立验证，不能把“看过”当成“掌握”。',
              demo: { marker, localDemoOnly: true, evidenceRefs: [`wrong-pattern:${wrongPattern.id}`, `topic-mastery:${mastery.id}`] }
            },
            createdAt: now
          }
        ]
      }
    }
  });

  const intervention = await prisma.learningIntervention.create({
    data: {
      decisionKey: `pr13e-browser-demo-${randomUUID()}`,
      userId: user.id,
      subjectCode: 'math',
      topicId: topic.id,
      stateVersion: 'pr13e-browser-demo-v1',
      policyVersion: 'intervention-shadow-rules-1',
      action: 'offer_micro_lesson',
      status: 'shadow_proposed',
      urgency: 'high',
      placement: 'between_sets',
      triggerCodes: ['repeated_misconception', 'minimum_sample_met'],
      suppressionCodes: [],
      contentPlan: { format: 'mini_lesson', preferredType: 'micro_lesson', depth: 'guided', verificationRequired: true },
      reasonSummary: '函数水平平移的方向判断已重复出错 4 次。建议在下一组题前用约 3 分钟观察参数与顶点的关系。',
      inputSnapshot: {
        marker,
        localDemoOnly: true,
        wrongPatternId: wrongPattern.id,
        topicMasteryId: mastery.id,
        recurrenceCount: wrongPattern.recurrenceCount,
        attemptCount: mastery.attemptCount,
        correctCount: mastery.correctCount,
        mastery: mastery.mastery,
        confidence: mastery.confidence
      },
      evidenceCutoffAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
  });

  const relativeUrl = `/agent?agentContextId=${encodeURIComponent(conversation.id)}`;
  const scenario = {
    schemaVersion: '1',
    marker,
    preparedAt: now.toISOString(),
    userId: user.id,
    email: demoEmail,
    conversationId: conversation.id,
    interventionId: intervention.id,
    topic: { id: topic.id, code: topic.code, title: topic.title },
    teachingAsset: { id: asset.id, stableKey: asset.stableKey, versionId: asset.versions[0].id },
    evidence: { wrongPatternId: wrongPattern.id, topicMasteryId: mastery.id },
    relativeUrl
  };
  fs.mkdirSync(path.dirname(scenarioPath), { recursive: true });
  fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

  console.log(JSON.stringify({
    status: 'ready',
    scenarioFile: path.relative(root, scenarioPath),
    credentialsFile: path.relative(root, credentialsPath),
    relativeUrl,
    expectedFlow: ['intervention_offer', 'teaching_workspace', 'active_prompt', 'independent_verification', 'verification_settlement', 'agent_next_action'],
    modelApiRequired: false
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
