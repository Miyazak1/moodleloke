require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { AdaptivePlannerService } = require('../backend/src/csca-special-practice/adaptive-planner.service');
const { PlannerAssistantService } = require('../backend/src/csca-special-practice/planner-assistant.service');
const { CscaAdaptiveService } = require('../backend/src/csca-special-practice/csca-adaptive.service');
const { CscaSpecialPracticeService } = require('../backend/src/csca-special-practice/csca-special-practice.service');
const { AdaptiveQuestionProviderService } = require('../backend/src/csca-special-practice/adaptive-question-provider.service');
const { MasteryEngineService } = require('../backend/src/csca-special-practice/mastery-engine.service');
const { AICoachProviderService } = require('../backend/src/csca-special-practice/ai-coach-provider.service');
const { AICoachService } = require('../backend/src/csca-special-practice/ai-coach.service');
const {
  buildCoachMessages,
  resolveCoachPromptVersion,
  supportedCoachPromptVersions,
  validateCoachPromptTemplate
} = require('../backend/src/csca-special-practice/ai-coach-prompt-templates');
const { AIEntitlementService } = require('../backend/src/csca-special-practice/ai-entitlement.service');
const { apiSecretStorageMode, decryptApiSecretFromStorage } = require('../backend/src/csca-special-practice/ai-secret-store');
const { AIObservabilityService } = require('../backend/src/csca-special-practice/ai-observability.service');
const { AIUsageMeterService } = require('../backend/src/csca-special-practice/ai-usage-meter.service');
const { TrainingEventService } = require('../backend/src/csca-special-practice/training-event.service');
const { MockExamMasteryBridgeService } = require('../backend/src/csca-mock-exam/mock-exam-mastery-bridge.service');
const { CommerceService } = require('../backend/src/commerce/commerce.service');
const { PaymentsService } = require('../backend/src/payments/payments.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

function makeTopics(count, subject = 'math') {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    code: `${subject}-${index + 1}`,
    title: `${subject} topic ${index + 1}`,
    module: index % 2 ? 'module-b' : 'module-a',
    subject,
    status: 'published',
    weight: count - index
  }));
}

async function testDiagnosticPlanner() {
  const topics = makeTopics(12);
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    }
  });

  const plan = await planner.planDiagnosticRound('math', 20);
  const difficultyCounts = plan.plannedTopics.reduce((counts, topic) => {
    counts[topic.targetDifficulty] = (counts[topic.targetDifficulty] ?? 0) + 1;
    return counts;
  }, {});
  const uniqueTopicCount = new Set(plan.plannedTopics.map((topic) => topic.topicId)).size;

  assertEqual(plan.strategy, 'diagnostic_baseline_balanced', 'Diagnostic planner strategy changed.');
  assertEqual(plan.roundSize, 20, 'Diagnostic planner must create a 20-question blueprint.');
  assertEqual(plan.plannedTopics.length, 20, 'Diagnostic planner must emit 20 planned topics.');
  assertEqual(difficultyCounts['基础'], 4, 'Diagnostic planner must include baseline questions.');
  assertEqual(difficultyCounts['中等'], 8, 'Diagnostic planner must include enough medium questions.');
  assertEqual(difficultyCounts['较难'], 4, 'Diagnostic planner must include harder questions.');
  assertEqual(difficultyCounts['挑战'], 4, 'Diagnostic planner must include challenge questions.');
  assert(uniqueTopicCount >= 12, 'Diagnostic planner should cover the subject topic pool before cycling.');
}

async function testPracticePlanner() {
  const topics = makeTopics(6);
  const masteryRows = [
    { topicId: 1, mastery: 0.9, confidence: 0.8, lastPracticedAt: new Date('2026-01-06') },
    { topicId: 2, mastery: 0.2, confidence: 0.6, lastPracticedAt: new Date('2026-01-05') },
    { topicId: 3, mastery: 0.3, confidence: 0.3, lastPracticedAt: new Date('2026-01-04') },
    { topicId: 4, mastery: 0.7, confidence: 0.5, lastPracticedAt: new Date('2025-01-01') },
    { topicId: 5, mastery: 0.5, confidence: 0.2, lastPracticedAt: new Date('2026-01-03') },
    { topicId: 6, mastery: 0.6, confidence: 0.4, lastPracticedAt: new Date('2026-01-02') }
  ];
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    },
    userCscaTopicMastery: {
      findMany: async () => masteryRows
    },
    cscaQuestionExposure: {
      findFirst: async () => ({ questionId: 9001 })
    },
    cscaTopicMapping: {
      findFirst: async () => ({ topicId: 5, topic: topics[4] })
    },
    cscaWrongPattern: {
      findMany: async () => []
    },
    cscaQuestion: {
      findMany: async () => []
    }
  });

  const plan = await planner.planRound(101, 'math', 5, 4);
  const topicIds = plan.plannedTopics.map((topic) => topic.topicId);
  const reasons = Object.fromEntries(plan.plannedTopics.map((topic) => [topic.topicId, topic.reason]));

  assertEqual(plan.strategy, 'weakest_recent_wrong_stale_challenge', 'Practice planner strategy changed.');
  assertEqual(plan.plannedTopics.length, 5, 'Practice planner must emit five planned topics.');
  assertEqual(topicIds[0], 4, 'Focused practice topic must be prioritized first.');
  assertEqual(reasons[4], 'user_focus_topic', 'Focused topic reason must be preserved.');
  assert(topicIds.includes(2) && topicIds.includes(3), 'Practice planner must include weak topics.');
  assert(topicIds.includes(5), 'Practice planner must include recent wrong topic when available.');
  assertEqual(new Set(topicIds).size, topicIds.length, 'Practice planner must not duplicate planned topics.');
}

async function testPracticePlannerDifficultyAdjustment() {
  const topics = makeTopics(5);
  const masteryRows = topics.map((topic, index) => ({
    topicId: topic.id,
    mastery: index === 0 ? 0.2 : 0.55,
    confidence: 0.5,
    lastPracticedAt: new Date(`2026-01-0${index + 1}`)
  }));
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    },
    userCscaTopicMastery: {
      findMany: async () => masteryRows
    },
    cscaQuestionExposure: {
      findFirst: async () => null
    },
    cscaTopicMapping: {
      findFirst: async () => null
    },
    cscaWrongPattern: {
      findMany: async () => []
    },
    cscaQuestion: {
      findMany: async () => []
    },
    cscaAdaptiveRound: {
      findMany: async () => [
        { correctCount: 5, wrongCount: 0, unansweredCount: 0, items: Array.from({ length: 5 }, () => ({ timeSpentSeconds: 35 })) },
        { correctCount: 4, wrongCount: 1, unansweredCount: 0, items: Array.from({ length: 5 }, () => ({ timeSpentSeconds: 42 })) }
      ]
    }
  });

  const increasePlan = await planner.planRound(101, 'math', 5);
  assertEqual(increasePlan.adjustment.direction, 'increase', 'Fast stable performance must increase next difficulty.');
  assertEqual(increasePlan.adjustment.reason, 'stable_fast_correct', 'Increase adjustment reason changed.');
  assertEqual(increasePlan.plannedTopics[0].baseDifficulty, '基础', 'Planner must preserve base difficulty.');
  assertEqual(increasePlan.plannedTopics[0].targetDifficulty, '中等', 'Planner must raise target difficulty by one level.');
  assertEqual(increasePlan.plannedTopics[0].difficultyAdjustment, 1, 'Planner topic must expose difficulty adjustment.');

  planner.prisma.cscaAdaptiveRound.findMany = async () => [
    { correctCount: 1, wrongCount: 4, unansweredCount: 0, items: Array.from({ length: 5 }, () => ({ timeSpentSeconds: 95 })) },
    { correctCount: 2, wrongCount: 2, unansweredCount: 1, items: Array.from({ length: 5 }, () => ({ timeSpentSeconds: 88 })) }
  ];
  const decreasePlan = await planner.planRound(101, 'math', 5);
  const mediumTopic = decreasePlan.plannedTopics.find((topic) => topic.baseDifficulty === '中等');
  assertEqual(decreasePlan.adjustment.direction, 'decrease', 'Low recent performance must decrease next difficulty.');
  assertEqual(decreasePlan.adjustment.reason, 'low_recent_accuracy', 'Decrease adjustment reason changed.');
  assertEqual(mediumTopic?.targetDifficulty, '基础', 'Planner must lower target difficulty by one level.');
}

async function testPracticePlannerPrioritizesMisconceptionVariants() {
  const topics = makeTopics(5);
  const masteryRows = topics.map((topic) => ({
    topicId: topic.id,
    mastery: topic.id === 3 ? 0.25 : 0.7,
    confidence: 0.5,
    lastPracticedAt: new Date('2026-01-01')
  }));
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    },
    userCscaTopicMastery: {
      findMany: async () => masteryRows
    },
    cscaQuestionExposure: {
      findFirst: async () => null
    },
    cscaTopicMapping: {
      findFirst: async () => null
    },
    cscaWrongPattern: {
      findMany: async () => [{
        topicId: 3,
        recurrenceCount: 3,
        metadata: {
          lastQuestionId: 8001,
          lastQuestionSource: 'csca_question',
          recentQuestionIds: [8001],
          recentQuestionRefs: [{ questionId: 8001, questionSource: 'csca_question' }]
        }
      }]
    },
    cscaQuestion: {
      findMany: async (query) => {
        assert(!query.where?.OR, 'Planner should use source-aware recent question refs instead of broad id/sourceQuestionId OR queries.');
        if (query.where?.sourceQuestionId) return [];
        return [{ id: 8101, topicId: 3, syllabusVersion: '2026', topic: { syllabusVersion: '2026' } }];
      }
    },
    cscaAdaptiveRound: {
      findMany: async () => []
    }
  });

  const plan = await planner.planRound(101, 'math', 5);
  const remediationTopic = plan.plannedTopics.find((topic) => topic.reason === 'misconception_variant_practice');
  assert(remediationTopic, 'Planner must prioritize approved variant questions for repeated misconception patterns.');
  assertEqual(remediationTopic.topicId, 3, 'Remediation variant topic must target the repeated misconception topic.');
  assert(remediationTopic.preferredQuestionIds?.includes(8101), 'Remediation plan must carry preferred approved variant question ids.');
}

async function testPracticePlannerPrioritizesCompletedConceptCardVariants() {
  const topics = makeTopics(5);
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    },
    userCscaTopicMastery: {
      findMany: async () => topics.map((topic) => ({
        topicId: topic.id,
        mastery: topic.id === 4 ? 0.25 : 0.7,
        confidence: 0.5,
        lastPracticedAt: new Date('2026-01-01')
      }))
    },
    cscaQuestionExposure: {
      findFirst: async () => null
    },
    cscaTopicMapping: {
      findFirst: async () => null
    },
    cscaWrongPattern: {
      findMany: async () => []
    },
    cscaTrainingEvent: {
      findMany: async () => [{
        metadata: { conceptCardId: 77, sourceQuestionId: 9001 }
      }]
    },
    cscaQuestion: {
      findMany: async (query) => {
        if (query.where?.OR) return [{ id: 9001 }];
        return [{ id: 9101, topicId: 4, syllabusVersion: '2026', topic: { syllabusVersion: '2026' } }];
      }
    },
    cscaAdaptiveRound: {
      findMany: async () => []
    }
  });

  const plan = await planner.planRound(101, 'math', 5);
  const remediationTopic = plan.plannedTopics.find((topic) => topic.reason === 'misconception_variant_practice');
  assert(remediationTopic, 'Planner must prioritize variants after a concept card is completed.');
  assertEqual(remediationTopic.topicId, 4, 'Completed concept card variant must target the source misconception topic.');
  assert(remediationTopic.preferredQuestionIds?.includes(9101), 'Completed concept card variant must carry preferred approved variant ids.');
}

async function testPracticePlannerSkipsStaleMisconceptionVariants() {
  const topics = makeTopics(5);
  const planner = new AdaptivePlannerService({
    cscaExamTopic: {
      findMany: async () => topics
    },
    userCscaTopicMastery: {
      findMany: async () => topics.map((topic) => ({
        topicId: topic.id,
        mastery: topic.id === 3 ? 0.25 : 0.7,
        confidence: 0.5,
        lastPracticedAt: new Date('2026-01-01')
      }))
    },
    cscaQuestionExposure: {
      findFirst: async () => null
    },
    cscaTopicMapping: {
      findFirst: async () => null
    },
    cscaWrongPattern: {
      findMany: async () => [{
        topicId: 3,
        recurrenceCount: 3,
        metadata: { lastQuestionId: 8001, recentQuestionIds: [8001] }
      }]
    },
    cscaTrainingEvent: {
      findMany: async () => []
    },
    cscaQuestion: {
      findMany: async (query) => {
        if (query.where?.OR) return [{ id: 8001 }];
        return [{ id: 8101, topicId: 3, syllabusVersion: '2025', topic: { syllabusVersion: '2026' } }];
      }
    },
    cscaAdaptiveRound: {
      findMany: async () => []
    }
  });

  const plan = await planner.planRound(101, 'math', 5);
  const remediationTopic = plan.plannedTopics.find((topic) => topic.reason === 'misconception_variant_practice');
  assertEqual(Boolean(remediationTopic), false, 'Planner must not prioritize stale syllabus variant questions.');
}

async function testPlannerAssistantGuard() {
  const assistant = new PlannerAssistantService();
  const basePlan = {
    subject: 'math',
    strategy: 'weakest_recent_wrong_stale_challenge',
    roundSize: 2,
    plannedTopics: [
      { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '基础', reason: 'weakest_topic' },
      { topicId: 2, code: 'math-2', title: 'Topic 2', module: null, targetDifficulty: '中等', reason: 'recent_wrong' }
    ]
  };
  assistant.localSuggestion = () => ({
    summary: 'Try a risky assistant plan.',
    actions: ['Risky action'],
    provider: { provider: 'test', model: 'planner-test', status: 'ok' },
    plannedTopics: [
      { topicId: 999, code: 'math-x', title: 'Out of scope', module: null, targetDifficulty: '挑战', reason: 'assistant_extra' },
      { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '挑战', reason: 'assistant_harder' }
    ]
  });

  const plan = await assistant.assist({ userId: 101, subject: 'math', basePlan });
  assertEqual(plan.plannerAssistant.status, 'adjusted_by_rule_guard', 'Planner assistant must mark unsafe suggestions as guard-adjusted.');
  assert(plan.plannerAssistant.rejectedReasons.includes('topic_not_in_rule_plan:999'), 'Planner assistant must reject topics outside the rule plan.');
  assert(plan.plannerAssistant.rejectedReasons.includes('difficulty_out_of_guard:1'), 'Planner assistant must reject excessive difficulty jumps.');
  assertEqual(plan.plannedTopics.length, 2, 'Planner assistant must preserve rule round size.');
  assertEqual(plan.plannedTopics[0].topicId, 1, 'Planner assistant must keep the safe rule topic.');
  assertEqual(plan.plannedTopics[0].targetDifficulty, '基础', 'Planner assistant must restore unsafe difficulty to rule difficulty.');
  assertEqual(plan.plannedTopics[1].topicId, 2, 'Planner assistant must fill missing topics from the rule plan.');
}

async function testPlannerAssistantProviderGuard() {
  const previous = process.env.CSCA_PLANNER_ASSISTANT_AI_ENABLED;
  process.env.CSCA_PLANNER_ASSISTANT_AI_ENABLED = 'true';
  try {
    const provider = {
      generate: async (request) => {
        assertEqual(request.type, 'planner_assistant', 'Planner assistant must request the structured planner ability.');
        assertEqual(request.input.language, 'en', 'Planner assistant must preserve the session question language.');
        assertEqual(request.input.constraints.finalAuthority, 'rule_guard', 'Planner assistant prompt must state the rule guard is final.');
        return {
          output: JSON.stringify({
            summary: 'Start with the newest weak evidence.',
            actions: ['Review the weak topic first.'],
            plannedTopics: [
              { topicId: 2, targetDifficulty: '较难', reason: 'assistant_reorders_recent_wrong', targetDifficultyReason: 'planner_assistant_llm' },
              { topicId: 1, targetDifficulty: '挑战', reason: 'assistant_too_hard', targetDifficultyReason: 'planner_assistant_llm' },
              { topicId: 999, targetDifficulty: '挑战', reason: 'assistant_extra_topic', targetDifficultyReason: 'planner_assistant_llm' }
            ]
          }),
          provider: 'openai',
          model: 'planner-test',
          status: 'success'
        };
      }
    };
    const assistant = new PlannerAssistantService(provider);
    const basePlan = {
      subject: 'math',
      strategy: 'weakest_recent_wrong_stale_challenge',
      roundSize: 3,
      plannedTopics: [
        { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '基础', reason: 'weakest_topic' },
        { topicId: 2, code: 'math-2', title: 'Topic 2', module: null, targetDifficulty: '中等', reason: 'recent_wrong' },
        { topicId: 3, code: 'math-3', title: 'Topic 3', module: null, targetDifficulty: '基础', reason: 'stale_review' }
      ]
    };

    const plan = await assistant.assist({ userId: 101, subject: 'math', basePlan, language: 'en' });
    assertEqual(plan.plannerAssistant.provider.provider, 'openai', 'Planner assistant must record the external provider.');
    assertEqual(plan.plannerAssistant.provider.status, 'success', 'Planner assistant must record provider status.');
    assertEqual(plan.plannerAssistant.status, 'adjusted_by_rule_guard', 'Rule guard must still govern provider suggestions.');
    assert(plan.plannerAssistant.rejectedReasons.includes('topic_not_in_rule_plan:999'), 'Provider planner suggestions must reject topics outside the rule plan.');
    assert(plan.plannerAssistant.rejectedReasons.includes('difficulty_out_of_guard:1'), 'Provider planner suggestions must reject unsafe difficulty jumps.');
    assertEqual(plan.plannedTopics[0].topicId, 2, 'Provider planner may safely reorder existing rule topics.');
    assertEqual(plan.plannedTopics[0].targetDifficulty, '较难', 'Provider planner may shift difficulty by one level.');
    assertEqual(plan.plannedTopics[1].topicId, 1, 'Provider planner must fill the second topic from safe rule candidates.');
    assertEqual(plan.plannedTopics[1].targetDifficulty, '基础', 'Unsafe provider difficulty must be restored to the rule difficulty.');
    assertEqual(plan.plannedTopics[2].topicId, 3, 'Provider planner must fill missing round slots from the rule plan.');
  } finally {
    if (previous === undefined) delete process.env.CSCA_PLANNER_ASSISTANT_AI_ENABLED;
    else process.env.CSCA_PLANNER_ASSISTANT_AI_ENABLED = previous;
  }
}

async function testQuestionProvider() {
  const mappings = [
    { sourceId: 11, topicId: 1, topic: { code: 'math-1', title: 'Topic 1' } },
    { sourceId: 12, topicId: 1, topic: { code: 'math-1', title: 'Topic 1' } },
    { sourceId: 21, topicId: 2, topic: { code: 'math-2', title: 'Topic 2' } },
    { sourceId: 22, topicId: 2, topic: { code: 'math-2', title: 'Topic 2' } }
  ];
  const questions = [
    { id: 11, difficulty: '基础' },
    { id: 12, difficulty: '挑战' },
    { id: 21, difficulty: '中等' },
    { id: 22, difficulty: '基础' }
  ];
  const provider = new AdaptiveQuestionProviderService({
    cscaTopicMapping: {
      findMany: async () => mappings
    },
    specialPracticeQuestion: {
      findMany: async () => questions
    },
    cscaQuestion: {
      findMany: async () => []
    },
    cscaQuestionExposure: {
      findMany: async () => [{ questionId: 11, seenCount: 3 }]
    }
  });

  const selected = await provider.pickQuestions(101, [
    { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '基础', reason: 'weakest_topic' },
    { topicId: 2, code: 'math-2', title: 'Topic 2', module: null, targetDifficulty: '中等', reason: 'weakest_topic' }
  ], 2);

  assertEqual(selected.length, 2, 'Question provider must pick requested number of questions.');
  assertEqual(selected[0].questionId, 11, 'Question provider must prefer target difficulty before lower exposure.');
  assertEqual(selected[0].questionSource, 'special_practice', 'Legacy provider candidates must expose special_practice source.');
  assertEqual(selected[1].questionId, 21, 'Question provider must prefer closest difficulty when exposure is tied.');
  assertEqual(new Set(selected.map((item) => item.questionId)).size, selected.length, 'Question provider must not duplicate questions.');
}

async function testQuestionProviderDirectUnifiedQuestions() {
  const provider = new AdaptiveQuestionProviderService({
    cscaQuestion: {
      findMany: async () => [
        {
          id: 701,
          topicId: 1,
          designedDifficulty: '中等',
          empiricalDifficulty: null,
          difficultyConfidence: null,
          syllabusVersion: '2026',
          topic: { code: 'math-1', title: 'Topic 1', syllabusVersion: '2026' }
        },
        {
          id: 702,
          topicId: 2,
          designedDifficulty: '基础',
          empiricalDifficulty: null,
          difficultyConfidence: null,
          syllabusVersion: '2025',
          topic: { code: 'math-2', title: 'Topic 2', syllabusVersion: '2026' }
        }
      ]
    },
    cscaTopicMapping: {
      findMany: async () => []
    },
    specialPracticeQuestion: {
      findMany: async () => []
    },
    cscaQuestionExposure: {
      findMany: async () => []
    }
  });

  const selected = await provider.pickQuestions(101, [
    { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '中等', reason: 'weakest_topic' },
    { topicId: 2, code: 'math-2', title: 'Topic 2', module: null, targetDifficulty: '基础', reason: 'weakest_topic' }
  ], 2);

  assertEqual(selected.length, 1, 'Provider must select current approved unified-bank questions and skip stale ones.');
  assertEqual(selected[0].questionId, 701, 'Provider must select the current unified-bank question.');
  assertEqual(selected[0].questionSource, 'csca_question', 'Unified-bank candidates must expose csca_question source.');
}

async function testQuestionProviderPreferredUnifiedVariant() {
  const provider = new AdaptiveQuestionProviderService({
    cscaQuestion: {
      findMany: async () => [
        {
          id: 701,
          topicId: 1,
          designedDifficulty: '中等',
          empiricalDifficulty: null,
          difficultyConfidence: null,
          syllabusVersion: '2026',
          topic: { code: 'math-1', title: 'Topic 1', syllabusVersion: '2026' }
        },
        {
          id: 703,
          topicId: 1,
          designedDifficulty: '挑战',
          empiricalDifficulty: null,
          difficultyConfidence: null,
          syllabusVersion: '2026',
          topic: { code: 'math-1', title: 'Topic 1', syllabusVersion: '2026' }
        }
      ]
    },
    cscaTopicMapping: {
      findMany: async () => []
    },
    specialPracticeQuestion: {
      findMany: async () => []
    },
    cscaQuestionExposure: {
      findMany: async () => []
    }
  });

  const selected = await provider.pickQuestions(101, [
    { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '中等', reason: 'misconception_variant_practice', preferredQuestionIds: [703] }
  ], 1);

  assertEqual(selected.length, 1, 'Provider must select a preferred unified-bank variant when available.');
  assertEqual(selected[0].questionId, 703, 'Provider must prefer remediation variant ids over normal difficulty match.');
  assertEqual(selected[0].questionSource, 'csca_question', 'Preferred variants must be selected from unified-bank questions.');
}

async function testQuestionProviderReduceExposureGovernance() {
  const provider = new AdaptiveQuestionProviderService({
    cscaQuestion: {
      findMany: async ({ where }) => {
        if (where?.sourceType === 'ai') {
          return [
            {
              sourceQuestionId: 801,
              status: 'approved',
              syllabusVersion: '2026',
              topicId: 1,
              generationMetadata: {
                scope: { targetUseCase: 'subject_practice' },
                versionGovernance: { status: 'current' }
              },
              reviewMetadata: {
                subjectPracticeAutoApproval: {
                  status: 'published_to_subject_practice',
                  targetUseCase: 'subject_practice',
                  targetQuestionBank: 'special_practice_questions'
                },
                qualityGovernance: {
                  disposition: 'reduce_exposure'
                }
              }
            },
            {
              sourceQuestionId: 802,
              status: 'approved',
              syllabusVersion: '2026',
              topicId: 1,
              generationMetadata: {
                scope: { targetUseCase: 'subject_practice' },
                versionGovernance: { status: 'current' }
              },
              reviewMetadata: {
                subjectPracticeAutoApproval: {
                  status: 'published_to_subject_practice',
                  targetUseCase: 'subject_practice',
                  targetQuestionBank: 'special_practice_questions'
                }
              }
            }
          ];
        }
        return [];
      }
    },
    cscaTopicMapping: {
      findMany: async () => [
        { sourceId: 801, topicId: 1, topic: { code: 'math-1', title: 'Topic 1', syllabusVersion: '2026' } },
        { sourceId: 802, topicId: 1, topic: { code: 'math-1', title: 'Topic 1', syllabusVersion: '2026' } }
      ]
    },
    specialPracticeQuestion: {
      findMany: async () => [
        { id: 801, difficulty: '基础' },
        { id: 802, difficulty: '基础' }
      ]
    },
    cscaQuestionExposure: {
      findMany: async () => []
    }
  });

  const selected = await provider.pickQuestions(101, [
    { topicId: 1, code: 'math-1', title: 'Topic 1', module: null, targetDifficulty: '基础', reason: 'weakest_topic' }
  ], 1);

  assertEqual(selected.length, 1, 'Provider must still find a question when reduced-exposure candidates exist.');
  assertEqual(selected[0].questionId, 802, 'Provider must prefer normal candidates before reduced-exposure AI-backed questions.');
}

async function testSpecialPracticeSessionFiltersGovernedAiQuestions() {
  const topic = {
    id: 90,
    subject: 'math',
    module: 'Governance',
    slug: 'governance-topic',
    title: 'Governance Topic',
    description: 'Governance topic.',
    overview: null,
    focusItems: null,
    studyAdvice: null,
    difficultyLabel: null,
    frequencyLabel: null,
    relatedResources: null,
    relatedVisualizerSlug: null,
    localizations: null,
    estimatedMinutes: 20,
    questionCount: 2,
    sortOrder: 1,
    status: 'published',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
  const questionBase = {
    topicId: topic.id,
    orderNumber: 1,
    difficulty: '基础',
    questionType: 'single-choice',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
      { id: 'C', text: '3' },
      { id: 'D', text: '4' }
    ],
    correctAnswer: 'B',
    explanation: 'Because.',
    knowledgeTags: ['governance'],
    localizations: null,
    status: 'published',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
  let capturedSnapshot = [];
  const service = new CscaSpecialPracticeService({
    specialPracticeTopic: {
      findFirst: async () => ({
        ...topic,
        questions: [
          { ...questionBase, id: 901, prompt: 'Governed AI-backed question' },
          { ...questionBase, id: 902, orderNumber: 2, prompt: 'Normal legacy question' }
        ]
      })
    },
    cscaQuestion: {
      findMany: async () => [
        {
          sourceQuestionId: 901,
          status: 'pending_review',
          syllabusVersion: '2026',
          topicId: 1,
          topic: { syllabusVersion: '2026', status: 'published' }
        }
      ]
    },
    specialPracticeSession: {
      create: async ({ data }) => {
        capturedSnapshot = data.questionSnapshot;
        return {
          id: 1,
          topicId: topic.id,
          userId: 101,
          language: data.language,
          questionSnapshot: data.questionSnapshot,
          answers: {},
          timeSpent: {},
          currentQuestion: 1,
          correctCount: 0,
          wrongCount: 0,
          unansweredCount: 0,
          startedAt: new Date('2026-01-01T00:00:00.000Z'),
          completedAt: null,
          version: 1
        };
      }
    }
  });

  let error = null;
  try {
    await service.createSession('governance-topic', 101, { language: 'zh' });
  } catch (caught) {
    error = caught;
  }
  assert(error, 'A topic must not start when governance filtering reduces the visible pool below its declared question count.');
  assertEqual(error.getStatus?.(), 409, 'An incomplete governed topic must return a conflict response.');
  const response = error.getResponse?.();
  assertEqual(response?.code, 'SPECIAL_PRACTICE_POOL_REPLENISHING', 'An incomplete governed topic must expose the replenishing state.');
  assertEqual(capturedSnapshot.length, 0, 'An incomplete governed topic must not create a partial student session.');
}

async function testSpecialPracticeSubjectCountsFilterGovernedAiQuestions() {
  const topic = {
    id: 90,
    subject: 'math',
    module: 'Governance',
    slug: 'governance-topic',
    title: 'Governance Topic',
    description: 'Governance topic.',
    overview: null,
    focusItems: null,
    studyAdvice: null,
    difficultyLabel: null,
    frequencyLabel: null,
    relatedResources: null,
    relatedVisualizerSlug: null,
    localizations: null,
    estimatedMinutes: 20,
    questionCount: 2,
    sortOrder: 1,
    status: 'published',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { questions: 2, sessions: 0 }
  };
  const questionBase = {
    topicId: topic.id,
    orderNumber: 1,
    difficulty: '基础',
    questionType: 'single-choice',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
    correctAnswer: 'B',
    explanation: 'Because.',
    knowledgeTags: ['governance'],
    localizations: null,
    status: 'published',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
  const service = new CscaSpecialPracticeService({
    specialPracticeTopic: {
      findMany: async () => [topic]
    },
    specialPracticeQuestion: {
      findMany: async () => [
        { ...questionBase, id: 901, prompt: 'Governed AI-backed question' },
        { ...questionBase, id: 902, orderNumber: 2, prompt: 'Normal legacy question' }
      ]
    },
    cscaQuestion: {
      findMany: async () => [{
        sourceQuestionId: 901,
        status: 'pending_review',
        syllabusVersion: '2026',
        topicId: 1,
        topic: { syllabusVersion: '2026', status: 'published' }
      }]
    }
  });

  const subject = await service.getSubject('math');
  assertEqual(subject.stats.questionCount, 1, 'Subject question counts must exclude AI-backed questions under governance review.');
  assertEqual(subject.modules[0].topics[0].publishedQuestionCount, 1, 'Topic summaries must show only currently practiceable questions.');
}

async function testMasteryEngine() {
  const rows = new Map();
  const mastery = new MasteryEngineService({
    userCscaTopicMastery: {
      findUnique: async ({ where }) => rows.get(`${where.userId_topicId.userId}:${where.userId_topicId.topicId}`) ?? null,
      upsert: async ({ where, create, update }) => {
        const key = `${where.userId_topicId.userId}:${where.userId_topicId.topicId}`;
        const next = rows.has(key) ? { ...rows.get(key), ...update } : create;
        rows.set(key, next);
        return next;
      }
    }
  });

  const [hintedCorrect] = await mastery.updateFromRound([{
    userId: 101,
    subject: 'math',
    topicId: 1,
    isCorrect: true,
    difficulty: '挑战',
    usedHint: true
  }]);
  assertEqual(Number(hintedCorrect.delta.toFixed(4)), 0.0325, 'Hint-assisted correct mastery delta changed.');
  assertEqual(Number(hintedCorrect.confidence.toFixed(2)), 0.24, 'Mastery confidence increment changed.');

  const [explainedCorrect] = await mastery.updateFromRound([{
    userId: 101,
    subject: 'math',
    topicId: 2,
    isCorrect: true,
    difficulty: '挑战',
    usedExplanation: true
  }]);
  assertEqual(Number(explainedCorrect.delta.toFixed(4)), 0.013, 'Explanation-assisted correct mastery delta changed.');

  const [wrongHard] = await mastery.updateFromRound([{
    userId: 101,
    subject: 'math',
    topicId: 3,
    isCorrect: false,
    difficulty: '较难'
  }]);
  assertEqual(Number(wrongHard.delta.toFixed(4)), -0.092, 'Wrong hard-question mastery penalty changed.');
}

async function testMockExamMasteryBridge() {
  const topics = [
    { id: 11, code: 'math-functions', title: '函数', module: '函数', subject: 'math', status: 'published', weight: 3 },
    { id: 12, code: 'math-geometry', title: '平面解析几何', module: '几何与代数', subject: 'math', status: 'published', weight: 2 }
  ];
  const rows = new Map();
  const mastery = new MasteryEngineService({
    userCscaTopicMastery: {
      findUnique: async ({ where }) => rows.get(`${where.userId_topicId.userId}:${where.userId_topicId.topicId}`) ?? null,
      upsert: async ({ where, create, update }) => {
        const key = `${where.userId_topicId.userId}:${where.userId_topicId.topicId}`;
        const next = rows.has(key) ? { ...rows.get(key), ...update } : create;
        rows.set(key, next);
        return next;
      }
    }
  });
  const bridge = new MockExamMasteryBridgeService({
    cscaExamTopic: {
      findMany: async ({ where }) => {
        assertEqual(where.subject, 'math', 'Mock exam mastery bridge must resolve topics inside the attempt subject.');
        return topics;
      }
    },
    mockExamQuestion: {
      findMany: async () => [
        { id: 1001, knowledgeTags: ['函数'] },
        { id: 1002, knowledgeTags: ['未映射标签'] },
        { id: 1004, knowledgeTags: ['未映射标签'] }
      ]
    },
    cscaTopicMapping: {
      findMany: async () => [{ sourceId: 1002, topicId: 12, confidence: 1, topic: topics[1] }]
    }
  }, mastery);

  const changes = await bridge.updateFromSubmittedAttempt({
    userId: 101,
    paper: { subject: 'math' },
    answers: { 1001: 'A', 1002: 'C', 1003: 'B' }
  }, [
    { id: 1001, correctAnswer: 'A', knowledgeTags: ['函数'] },
    { id: 1002, correctAnswer: 'D', knowledgeTags: ['未映射标签'] },
    { id: 1003, correctAnswer: 'B', knowledgeTags: ['解析几何'] },
    { id: 1004, correctAnswer: 'A', knowledgeTags: ['未映射标签'] }
  ]);

  assertEqual(changes.length, 3, 'Mock exam mastery bridge must update only mapped questions.');
  assertEqual(changes[0].topicId, 11, 'Mock exam tag must map exact topic title.');
  assertEqual(changes[1].topicId, 12, 'Mock exam explicit mapping must win before tag fallback.');
  assertEqual(changes[2].topicId, 12, 'Mock exam tag must map fuzzy topic title.');
  assert(rows.has('101:11'), 'Mock exam bridge must persist mastery for exact tag match.');
  assert(rows.has('101:12'), 'Mock exam bridge must persist mastery for fuzzy tag match.');
}

function testAIUsageMeter() {
  const meter = new AIUsageMeterService();
  const pricingKeys = [
    'CSCA_AI_INPUT_COST_PER_1K_TOKENS',
    'CSCA_AI_OUTPUT_COST_PER_1K_TOKENS',
    'CSCA_AI_UNIT_TOKEN_BUDGET',
    'CSCA_AI_COST_CURRENCY'
  ];
  const originalEnv = Object.fromEntries(pricingKeys.map((key) => [key, process.env[key]]));
  for (const key of pricingKeys) delete process.env[key];
  const fallback = meter.measure({
    type: 'hint',
    provider: 'rule-fallback',
    model: 'local-rule-v1',
    promptVersion: 'coach-rule-v1',
    input: { questionId: 1 },
    output: 'Try separating known values from the target.',
    startedAt: Date.now() - 5
  });
  assertEqual(fallback.tokenUsage.billable, false, 'Rule fallback usage must not be billable.');
  assertEqual(fallback.costEstimate, 0, 'Rule fallback usage must keep zero cost.');
  assertEqual(fallback.tokenUsage.unitEstimate, 0, 'Rule fallback usage must not estimate charged units.');
  assert(fallback.tokenUsage.totalTokensEstimate > 1, 'Usage meter must estimate tokens.');

  const external = meter.measure({
    type: 'hint',
    provider: 'openai',
    model: 'example-model',
    promptVersion: 'coach-v1',
    input: 'input',
    output: 'output',
    startedAt: Date.now()
  });
  assertEqual(external.tokenUsage.billable, true, 'External provider usage must be marked billable.');
  assertEqual(external.tokenUsage.pricingConfigured, false, 'External provider pricing should stay unconfigured without rate envs.');
  assertEqual(external.costEstimate, 0, 'External provider cost estimate must be zero until pricing is configured.');
  assertEqual(external.tokenUsage.unitEstimate, 1, 'External provider usage must estimate at least one billable unit.');

  process.env.CSCA_AI_INPUT_COST_PER_1K_TOKENS = '0.002';
  process.env.CSCA_AI_OUTPUT_COST_PER_1K_TOKENS = '0.004';
  process.env.CSCA_AI_UNIT_TOKEN_BUDGET = '3';
  process.env.CSCA_AI_COST_CURRENCY = 'USD';
  const pricedExternal = meter.measure({
    type: 'explain_wrong_answer',
    provider: 'openai',
    model: 'example-model',
    promptVersion: 'coach-v1',
    input: 'input',
    output: 'output',
    startedAt: Date.now()
  });
  assertEqual(pricedExternal.tokenUsage.pricingConfigured, true, 'Usage meter must expose configured pricing state.');
  assertEqual(pricedExternal.tokenUsage.currency, 'USD', 'Usage meter must preserve configured currency.');
  assertEqual(pricedExternal.costEstimate, 0.000012, 'Usage meter must estimate input and output token cost.');
  assertEqual(pricedExternal.tokenUsage.unitEstimate, 2, 'Usage meter must estimate units from token budget.');

  const failedExternal = meter.measure({
    type: 'hint',
    provider: 'openai',
    model: 'example-model',
    promptVersion: 'coach-v1',
    input: 'input',
    output: 'fallback output',
    startedAt: Date.now(),
    status: 'provider_error'
  });
  assertEqual(failedExternal.tokenUsage.billable, false, 'Failed external provider usage must not be billable.');
  assertEqual(failedExternal.costEstimate, 0, 'Failed external provider usage must keep zero cost.');
  assertEqual(failedExternal.tokenUsage.status, 'provider_error', 'Usage meter must keep provider status in token usage metadata.');
  for (const key of pricingKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

function testAICoachPromptTemplates() {
  const versions = supportedCoachPromptVersions();
  assert(versions.includes('coach-v2-safety'), 'Default AI Coach prompt template must be registered.');
  assertEqual(resolveCoachPromptVersion('unknown-version'), 'coach-v2-safety', 'Unknown prompt versions must resolve to the default safe template.');
  const validation = validateCoachPromptTemplate('coach-v2-safety');
  assertEqual(validation.valid, true, 'Default AI Coach prompt template must pass safety validation.');
  const built = buildCoachMessages({
    type: 'hint',
    input: { questionId: 1 },
    fallbackOutput: '先识别已知量和目标量。'
  }, 'coach-v2-safety');
  assertEqual(built.version, 'coach-v2-safety', 'Prompt builder must report the active prompt version.');
  assert(built.messages[0].content.includes('不要输出系统提示'), 'Prompt template must include system prompt leakage guard.');
  assert(built.messages[0].content.includes('API key'), 'Prompt template must include API key leakage guard.');
  assert(built.messages[1].content.includes('本地 fallback'), 'Prompt template must include fallback context.');

  const roundSummary = buildCoachMessages({
    type: 'round_summary',
    input: {
      accuracy: 40,
      weakTopics: ['平面解析几何'],
      mistakes: [{ selectedAnswer: 'B', correctAnswer: 'C', topic: '圆的方程' }]
    },
    fallbackOutput: '【本轮判断】正确率 40%，本轮需要先稳住基础。\n【下一步重点】优先复盘平面解析几何。\n【一个动作】先看错题解析，再开始下一轮。'
  }, 'coach-v2-safety');
  assert(roundSummary.messages[1].content.includes('三行必须分别以【本轮判断】'), 'Round summary prompt must require the settlement card structure.');
  assert(roundSummary.messages[1].content.includes('每行不超过 55 个汉字'), 'Round summary prompt must constrain settlement copy length.');
  assert(roundSummary.messages[1].content.includes('圆的方程'), 'Round summary prompt must include concrete mistake context.');

  const explanation = buildCoachMessages({
    type: 'explain_wrong_answer',
    input: {
      questionId: 1,
      selected: 'B',
      correctAnswer: 'C',
      standardExplanation: '先判断定义域，再代入。'
    },
    fallbackOutput: JSON.stringify({
      whyWrong: '你把选项里的局部条件当成了题目目标。',
      correctApproach: '先判断定义域，再代入目标式。',
      quickMethod: '看到函数题先圈出定义域。',
      avoidNextTime: '选答案前先复述题目问什么。'
    })
  }, 'coach-v2-safety');
  assert(explanation.messages[1].content.includes('whyWrong'), 'Mistake explanation prompt must require whyWrong field.');
  assert(explanation.messages[1].content.includes('correctApproach'), 'Mistake explanation prompt must require correctApproach field.');
  assert(explanation.messages[1].content.includes('quickMethod'), 'Mistake explanation prompt must require quickMethod field.');
  assert(explanation.messages[1].content.includes('avoidNextTime'), 'Mistake explanation prompt must require avoidNextTime field.');
  assert(explanation.messages[1].content.includes('只返回一个合法 JSON object'), 'Mistake explanation prompt must require JSON-only output.');
}

async function testAIEntitlementGrant() {
  const auditLogs = [];
  const ledgerRows = [];
  const tx = {
    user: {
      findUnique: async ({ where, select }) => {
        assertEqual(where.id, 101, 'AI entitlement grant must target the requested user.');
        assert(select.email === true, 'AI entitlement grant must select user email for audit.');
        return { id: 101, email: 'student@example.test', loginName: null, status: 'active' };
      }
    },
    cscaAIEntitlementAccount: {
      upsert: async ({ where, create, update }) => {
        assertEqual(where.userId, 101, 'AI entitlement grant must upsert by user id.');
        assertEqual(create.balanceUnits, 25, 'AI entitlement grant must initialize balance with grant units.');
        assertEqual(update.balanceUnits.increment, 25, 'AI entitlement grant must increment existing balance.');
        return { id: 501, userId: 101, balanceUnits: 45, lifetimeGranted: 65, lifetimeUsed: 20 };
      }
    },
    cscaAIUsageLedger: {
      create: async ({ data }) => {
        ledgerRows.push(data);
        return { id: 901, ...data };
      }
    },
    adminAuditLog: {
      create: async ({ data }) => {
        auditLogs.push(data);
        return { id: 1001, ...data };
      }
    }
  };
  const service = new AIEntitlementService({
    $transaction: async (fn) => fn(tx)
  });
  const result = await service.grant(101, 1, { units: 25, reason: 'Pilot grant', source: 'admin_manual_grant' });

  assertEqual(result.balanceUnits, 45, 'AI entitlement grant must return the updated balance.');
  assertEqual(result.grantedUnits, 25, 'AI entitlement grant must return granted units.');
  assertEqual(ledgerRows.length, 1, 'AI entitlement grant must write one ledger row.');
  assertEqual(ledgerRows[0].abilityType, 'ai_credit_grant', 'AI entitlement grant ledger must use grant ability type.');
  assertEqual(ledgerRows[0].unitsDelta, 25, 'AI entitlement grant ledger must use positive units delta.');
  assertEqual(ledgerRows[0].metadata.balanceAfterGrant, 45, 'AI entitlement grant ledger must record balance snapshot.');
  assertEqual(auditLogs.length, 1, 'AI entitlement grant must write an admin audit log.');
  assertEqual(auditLogs[0].action, 'ai_entitlement.grant', 'AI entitlement grant audit action changed.');
  assertEqual(auditLogs[0].after.units, 25, 'AI entitlement grant audit must record granted units.');
}

async function testAIEntitlementFallbackReserveIsNotLedgered() {
  const service = new AIEntitlementService({
    cscaAIEntitlementAccount: {
      upsert: async () => {
        throw new Error('Rule fallback reserve must not touch entitlement accounts.');
      }
    },
    cscaAIUsageLedger: {
      create: async () => {
        throw new Error('Rule fallback reserve must not write usage ledger rows.');
      }
    }
  });

  const reservation = await service.reserve(101, 'hint', { provider: 'rule-fallback', model: 'rule-fallback' });

  assertEqual(reservation.allowed, true, 'Rule fallback reserve must be allowed without paid units.');
  assertEqual(reservation.balanceUnits, 0, 'Rule fallback reserve must not expose a paid balance change.');
  assertEqual(reservation.ledgerId, undefined, 'Rule fallback reserve must not create a usage ledger id.');
}

async function testAIEntitlementUnlimitedEmailReserve() {
  const ledgerRows = [];
  let accountUpdates = 0;
  const service = new AIEntitlementService({
    user: {
      findUnique: async ({ where, select }) => {
        assertEqual(where.id, 101, 'Unlimited AI lookup must target the requesting user.');
        assert(select.email === true && select.loginName === true, 'Unlimited AI lookup must select email identifiers.');
        return { email: 'misakitoufu@gmail.com', loginName: null };
      }
    },
    cscaAIEntitlementAccount: {
      upsert: async ({ where, create, update }) => {
        assertEqual(where.userId, 101, 'Unlimited AI reserve must ensure the user account.');
        assertEqual(create.balanceUnits, 50, 'Unlimited AI reserve must keep normal initial balance creation.');
        assert(Object.keys(update).length === 0, 'Unlimited AI reserve must not mutate account during ensure.');
        return { id: 501, userId: 101, balanceUnits: 0, lifetimeGranted: 50, lifetimeUsed: 7 };
      },
      updateMany: async () => {
        throw new Error('Unlimited AI reserve must not decrement balance.');
      },
      update: async ({ where, data }) => {
        accountUpdates += 1;
        assertEqual(where.id, 501, 'Unlimited AI commit must update the ensured account.');
        assertEqual(data.lifetimeUsed.increment, 1, 'Unlimited AI commit should still count successful AI usage.');
      }
    },
    cscaAIUsageLedger: {
      create: async ({ data }) => {
        ledgerRows.push(data);
        return { id: 701, ...data };
      },
      update: async ({ where, data }) => {
        ledgerRows.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      }
    },
    $transaction: async (operations) => {
      assert(Array.isArray(operations), 'Unlimited AI commit must use transaction operations.');
      return Promise.all(operations);
    }
  });

  const reservation = await service.reserve(101, 'hint', { provider: 'deepseek', model: 'deepseek-chat' });
  assertEqual(reservation.allowed, true, 'Unlimited AI reserve must be allowed with zero balance.');
  assertEqual(reservation.unlimited, true, 'Unlimited AI reserve must mark the reservation.');
  assertEqual(reservation.balanceUnits, 0, 'Unlimited AI reserve must preserve account balance.');
  assertEqual(ledgerRows[0].unitsDelta, 0, 'Unlimited AI reserve must not spend units.');
  assertEqual(ledgerRows[0].reason, 'unlimited_reserve', 'Unlimited AI reserve must write a clear ledger reason.');

  await service.commit(reservation, { interactionId: 91, provider: 'deepseek', model: 'deepseek-chat' });
  assertEqual(accountUpdates, 1, 'Unlimited AI commit must increment lifetime usage once.');
  assertEqual(ledgerRows[1].status, 'posted', 'Unlimited AI commit must post the reservation ledger.');

  await service.refund(reservation, { interactionId: 91, reason: 'provider_failed', provider: 'deepseek', model: 'deepseek-chat' });
  assertEqual(accountUpdates, 1, 'Unlimited AI refund must not add balance back.');
  assertEqual(ledgerRows[2].status, 'refunded', 'Unlimited AI refund must mark the ledger refunded.');
  assertEqual(ledgerRows[2].unitsDelta, 0, 'Unlimited AI refund must keep a zero unit delta.');
}

async function testOrganizationAIEntitlementReserveCommitRefund() {
  const ledgerRows = [];
  let pool = {
    id: 801,
    organizationId: 301,
    availableCredits: 3,
    reservedCredits: 0,
    expiresAt: null,
    perUserDailyLimit: 5,
    status: 'active'
  };
  const tx = {
    organizationAiCreditPool: {
      findFirst: async ({ where }) => where.id === pool.id && pool.availableCredits > 0 ? pool : null,
      update: async ({ where, data }) => {
        assertEqual(where.id, pool.id, 'Organization reservation must update the active pool.');
        pool = {
          ...pool,
          availableCredits: pool.availableCredits + (data.availableCredits?.increment ?? 0) - (data.availableCredits?.decrement ?? 0),
          reservedCredits: pool.reservedCredits + (data.reservedCredits?.increment ?? 0) - (data.reservedCredits?.decrement ?? 0)
        };
        return pool;
      }
    },
    cscaAIUsageLedger: {
      create: async ({ data }) => {
        const row = { id: 900 + ledgerRows.length, ...data };
        ledgerRows.push(row);
        return row;
      }
    }
  };
  const prisma = {
    organizationMember: {
      findMany: async ({ where, include }) => {
        assertEqual(where.userId, 101, 'Organization entitlement lookup must target the requesting user.');
        assert(include.organization.include.aiCreditPool === true, 'Organization entitlement lookup must include credit pool.');
        return [{
          id: 601,
          userId: 101,
          organizationId: 301,
          role: 'student',
          status: 'active',
          organization: {
            id: 301,
            slug: 'demo-school',
            name: 'Demo School',
            aiCreditPool: pool,
            llmProviderConfigs: [{ id: 701, provider: 'openai-compatible', model: 'org-model', status: 'active' }]
          }
        }];
      }
    },
    cscaAIUsageLedger: {
      count: async ({ where }) => {
        assertEqual(where.metadata.path[0], 'organizationId', 'Daily limit check must filter by organization metadata.');
        return 0;
      },
      create: tx.cscaAIUsageLedger.create,
      update: async ({ where, data }) => {
        ledgerRows.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      }
    },
    organizationAiCreditPool: tx.organizationAiCreditPool,
    cscaAIEntitlementAccount: {
      upsert: async () => {
        throw new Error('Organization entitlement must not touch personal account while organization pool has credits.');
      }
    },
    $transaction: async (input) => {
      if (typeof input === 'function') return input(tx);
      return Promise.all(input);
    }
  };
  const service = new AIEntitlementService(prisma);

  const reservation = await service.reserve(101, 'hint', { provider: 'openai-compatible', model: 'org-model' });
  assertEqual(reservation.allowed, true, 'Organization credit pool must allow reservation when credits are available.');
  assertEqual(reservation.source, 'organization', 'Organization reservation must expose reservation source.');
  assertEqual(reservation.organizationId, 301, 'Organization reservation must expose organization id.');
  assertEqual(pool.availableCredits, 2, 'Organization reserve must decrement available credits.');
  assertEqual(pool.reservedCredits, 1, 'Organization reserve must increment reserved credits.');
  assertEqual(ledgerRows[0].reason, 'organization_reserve', 'Organization reserve must write a clear ledger reason.');
  assertEqual(ledgerRows[0].metadata.organizationId, 301, 'Organization reserve ledger must record organization id.');

  await service.commit(reservation, { interactionId: 91, provider: 'openai-compatible', model: 'org-model', metadata: { costEstimate: 0.01 } });
  assertEqual(pool.availableCredits, 2, 'Organization commit must keep consumed available credits spent.');
  assertEqual(pool.reservedCredits, 0, 'Organization commit must release reserved credits.');
  assertEqual(ledgerRows[1].reason, 'consume', 'Organization commit must post consumption.');
  assertEqual(ledgerRows[1].metadata.reservationSource, 'organization', 'Organization commit must preserve source metadata.');

  const refundable = await service.reserve(101, 'hint', { provider: 'openai-compatible', model: 'org-model' });
  await service.refund(refundable, { interactionId: 92, reason: 'provider_failed', provider: 'openai-compatible', model: 'org-model' });
  assertEqual(pool.availableCredits, 2, 'Organization refund must restore the reserved credit.');
  assertEqual(pool.reservedCredits, 0, 'Organization refund must clear reserved credits.');
  assertEqual(ledgerRows[3].status, 'refunded', 'Organization refund must mark ledger refunded.');
}

async function testPlatformPersonalReserveSkipsOrganizationPool() {
  const ledgerRows = [];
  let account = { id: 501, userId: 101, balanceUnits: 2, lifetimeGranted: 50, lifetimeUsed: 0 };
  const tx = {
    cscaAIEntitlementAccount: {
      findUnique: async ({ where }) => where.userId === 101 || where.id === account.id ? account : null,
      updateMany: async ({ where, data }) => {
        assertEqual(where.id, account.id, 'Personal platform reserve must update the personal account.');
        assertEqual(where.balanceUnits.gt, 0, 'Personal platform reserve must guard positive balance.');
        account = { ...account, balanceUnits: account.balanceUnits - (data.balanceUnits?.decrement ?? 0) };
        return { count: 1 };
      }
    },
    cscaAIUsageLedger: {
      create: async ({ data }) => {
        const row = { id: 900 + ledgerRows.length, ...data };
        ledgerRows.push(row);
        return row;
      }
    }
  };
  const service = new AIEntitlementService({
    organizationMember: {
      findMany: async () => {
        throw new Error('Personal platform pool must not inspect or reserve organization credits.');
      }
    },
    user: {
      findUnique: async () => ({ email: 'student@example.test', loginName: null })
    },
    cscaAIEntitlementAccount: {
      upsert: async () => account
    },
    cscaAIUsageLedger: tx.cscaAIUsageLedger,
    $transaction: async (input) => input(tx)
  });

  const reservation = await service.reserve(101, 'hint', {
    provider: 'deepseek',
    model: 'deepseek-chat',
    providerSource: 'platform'
  });

  assertEqual(reservation.allowed, true, 'Personal platform pool must reserve personal credits when available.');
  assertEqual(reservation.source, 'personal', 'Personal platform pool must expose personal reservation source.');
  assertEqual(account.balanceUnits, 1, 'Personal platform reserve must decrement personal balance.');
  assertEqual(ledgerRows[0].reason, 'reserve', 'Personal platform reserve must use the personal reserve ledger reason.');
}

async function testOrganizationAIAdminManagementMasksProviderSecret() {
  const previousSecret = process.env.CSCA_ORG_LLM_KEY_SECRET;
  process.env.CSCA_ORG_LLM_KEY_SECRET = 'organization-secret-store-test-key';
  const auditRows = [];
  const state = {
    organization: null,
    pool: null,
    provider: null
  };
  const prisma = {
    organization: {
      findUnique: async ({ where, include }) => {
        if (include) {
          if (!state.organization || (where.id && where.id !== state.organization.id)) return null;
          return {
            ...state.organization,
            aiCreditPool: state.pool,
            members: [],
            llmProviderConfigs: state.provider ? [state.provider] : []
          };
        }
        if (where.id) return state.organization?.id === where.id ? state.organization : null;
        if (where.slug) return state.organization?.slug === where.slug ? state.organization : null;
        return null;
      },
      findMany: async () => state.organization ? [{
        ...state.organization,
        aiCreditPool: state.pool,
        members: [],
        llmProviderConfigs: state.provider ? [state.provider] : []
      }] : [],
      create: async ({ data }) => {
        state.organization = { id: 301, createdAt: new Date('2026-06-11T00:00:00.000Z'), updatedAt: new Date('2026-06-11T00:00:00.000Z'), ...data };
        return state.organization;
      },
      update: async ({ where, data }) => {
        assertEqual(where.id, state.organization.id, 'Organization update must target existing organization.');
        state.organization = { ...state.organization, ...data, updatedAt: new Date('2026-06-11T01:00:00.000Z') };
        return state.organization;
      }
    },
    organizationAiCreditPool: {
      findUnique: async ({ where }) => where.organizationId === state.organization?.id ? state.pool : null,
      upsert: async ({ where, create, update }) => {
        assertEqual(where.organizationId, state.organization.id, 'Credit pool upsert must target organization.');
        state.pool = state.pool
          ? { ...state.pool, ...update, updatedAt: new Date('2026-06-11T02:00:00.000Z') }
          : { id: 401, updatedAt: new Date('2026-06-11T02:00:00.000Z'), ...create };
        return state.pool;
      }
    },
    organizationLlmProviderConfig: {
      findFirst: async ({ where }) => {
        if (!state.provider || where.organizationId !== state.organization.id) return null;
        if (where.id && where.id !== state.provider.id) return null;
        return state.provider;
      },
      create: async ({ data }) => {
        state.provider = { id: 501, createdAt: new Date('2026-06-11T03:00:00.000Z'), updatedAt: new Date('2026-06-11T03:00:00.000Z'), ...data };
        return state.provider;
      },
      update: async ({ where, data }) => {
        assertEqual(where.id, state.provider.id, 'Provider update must target existing config.');
        state.provider = { ...state.provider, ...data, updatedAt: new Date('2026-06-11T04:00:00.000Z') };
        return state.provider;
      }
    },
    adminAuditLog: {
      create: async ({ data }) => {
        auditRows.push(data);
        return { id: auditRows.length, ...data };
      }
    },
    $queryRaw: async () => []
  };
  const service = new AIEntitlementService(prisma);

  const organization = await service.upsertOrganization(1, { slug: 'Demo School', name: 'Demo School', type: 'school', status: 'active' });
  assertEqual(organization.slug, 'demo-school', 'Organization management must normalize slugs.');
  await service.upsertOrganizationCreditPool(1, organization.id, { availableCredits: 120, reservedCredits: 0, perUserDailyLimit: 3, status: 'active' });
  const withProvider = await service.upsertOrganizationProvider(1, organization.id, {
    provider: 'openai-compatible',
    model: 'org-model',
    apiKey: 'secret-key',
    baseUrl: 'https://org.example.test/v1',
    status: 'active'
  });
  assertEqual(withProvider.llmProviderConfigs[0].apiKeyConfigured, true, 'Organization provider summary must expose key presence.');
  assertEqual(withProvider.llmProviderConfigs[0].encryptedApiKey, undefined, 'Organization provider summary must never return the stored API key.');
  assertEqual(apiSecretStorageMode(state.provider.encryptedApiKey), 'encrypted', 'Organization provider should store encrypted API keys when a storage secret is configured.');
  assertEqual(decryptApiSecretFromStorage(state.provider.encryptedApiKey), 'secret-key', 'Encrypted organization provider key must be decryptable at runtime.');
  const listed = await service.listOrganizations();
  assertEqual(listed.items[0].aiCreditPool.availableCredits, 120, 'Organization list must include credit pool summary.');
  assertEqual(listed.items[0].llmProviderConfigs[0].apiKeyConfigured, true, 'Organization list must include masked provider config.');
  assert(auditRows.some((row) => row.action === 'organization.create'), 'Organization create must be audited.');
  assert(auditRows.some((row) => row.action === 'organization.credit_pool.create'), 'Organization credit pool upsert must be audited.');
  assert(auditRows.some((row) => row.action === 'organization.provider.create'), 'Organization provider upsert must be audited.');
  assert(!JSON.stringify(auditRows).includes('secret-key'), 'Admin audit logs must not include raw provider secrets.');
  if (previousSecret === undefined) delete process.env.CSCA_ORG_LLM_KEY_SECRET;
  else process.env.CSCA_ORG_LLM_KEY_SECRET = previousSecret;
}

function testOrganizationAISecretStoreLegacyCompatibility() {
  const previousSecret = process.env.CSCA_ORG_LLM_KEY_SECRET;
  delete process.env.CSCA_ORG_LLM_KEY_SECRET;
  assertEqual(decryptApiSecretFromStorage('plain:legacy-key'), 'legacy-key', 'Secret store must keep plain legacy key compatibility.');
  assertEqual(decryptApiSecretFromStorage(`base64:${Buffer.from('legacy-base64-key', 'utf8').toString('base64')}`), 'legacy-base64-key', 'Secret store must keep base64 legacy key compatibility.');
  assertEqual(apiSecretStorageMode('plain:legacy-key'), 'plain_legacy', 'Secret store should classify plain legacy values.');
  assertEqual(apiSecretStorageMode(`base64:${Buffer.from('legacy-base64-key', 'utf8').toString('base64')}`), 'base64_legacy', 'Secret store should classify base64 legacy values.');
  if (previousSecret === undefined) delete process.env.CSCA_ORG_LLM_KEY_SECRET;
  else process.env.CSCA_ORG_LLM_KEY_SECRET = previousSecret;
}

function testAICreditCommercePricing() {
  const service = new CommerceService({});
  const pricing = service.priceItems([
    {
      type: 'AI_CREDITS',
      quantity: 2,
      schoolId: null,
      school: null
    }
  ]);
  assertEqual(pricing.currency, 'USD', 'AI credit commerce pricing must use USD.');
  assertEqual(pricing.pricingBreakdown.length, 1, 'AI credit commerce pricing must create one line.');
  assertEqual(pricing.pricingBreakdown[0].type, 'AI_CREDITS', 'AI credit commerce line type changed.');
  assertEqual(pricing.pricingBreakdown[0].unitAmountCents, 990, 'AI credit pack unit price changed.');
  assertEqual(pricing.pricingBreakdown[0].aiCreditUnits, 200, 'AI credit pack must expose total credit units.');
  assertEqual(pricing.payableTotalCents, 1980, 'AI credit pack payable total changed.');
}

async function testAICreditPaymentFulfillment() {
  const ledgerRows = [];
  const tx = {
    orderItem: {
      findMany: async ({ where, select }) => {
        assertEqual(where.orderId, 55, 'Payment fulfillment must read order items by order id.');
        assertEqual(where.type, 'AI_CREDITS', 'Payment fulfillment must only fulfill AI credit items.');
        assert(select.metadata === true, 'Payment fulfillment must select metadata.');
        return [{ id: 501, quantity: 1, metadata: { aiCreditUnits: 100 } }];
      }
    },
    cscaAIUsageLedger: {
      findFirst: async ({ where }) => {
        assertEqual(where.abilityType, 'ai_credit_purchase', 'Payment fulfillment idempotency must check purchase ledger.');
        return null;
      },
      create: async ({ data }) => {
        ledgerRows.push(data);
        return { id: 777, ...data };
      }
    },
    cscaAIEntitlementAccount: {
      upsert: async ({ where, create, update }) => {
        assertEqual(where.userId, 101, 'Payment fulfillment must upsert account by user id.');
        assertEqual(create.balanceUnits, 100, 'Payment fulfillment must initialize account with purchased units.');
        assertEqual(update.balanceUnits.increment, 100, 'Payment fulfillment must increment purchased units.');
        return { id: 88, userId: 101, balanceUnits: 140, lifetimeGranted: 200, lifetimeUsed: 60 };
      }
    }
  };
  const service = new PaymentsService({});
  await service.fulfillPaidOrder(tx, { orderId: 55, userId: 101, paymentId: 66, providerTxnId: 'mock-paid' });
  assertEqual(ledgerRows.length, 1, 'Payment fulfillment must write one purchase ledger row.');
  assertEqual(ledgerRows[0].abilityType, 'ai_credit_purchase', 'Payment fulfillment purchase ability type changed.');
  assertEqual(ledgerRows[0].unitsDelta, 100, 'Payment fulfillment must grant purchased units.');
  assertEqual(ledgerRows[0].metadata.orderId, 55, 'Payment fulfillment ledger must record order id.');
  assertEqual(ledgerRows[0].metadata.balanceAfterGrant, 140, 'Payment fulfillment ledger must record balance snapshot.');
}

async function withProviderEnv(env, fn) {
  const keys = [
    'AI_DEFAULT_PROVIDER',
    'DEEPSEEK_API_KEYS',
    'DEEPSEEK_DEFAULT_MODEL',
    'CSCA_AI_COACH_ENABLED',
    'CSCA_AI_PROVIDER',
    'CSCA_AI_API_KEY',
    'CSCA_AI_MODEL',
    'CSCA_AI_BASE_URL',
    'CSCA_AI_TEMPERATURE',
    'CSCA_AI_PROMPT_VERSION',
    'CSCA_AI_TIMEOUT_MS',
    'CSCA_AI_MAX_OUTPUT_CHARS',
    'CSCA_AI_ROLLOUT_PERCENT'
  ];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

function fakeGateway(options = {}) {
  const calls = [];
  const gateway = {
    calls,
    hasConfiguredKey: () => options.hasKey !== false,
    complete: async (request) => {
      calls.push(request);
      if (typeof options.onComplete === 'function') options.onComplete(request);
      const status = options.status || 'success';
      const providerId = options.providerId || request.providerConfigOverride?.provider || 'openai-compatible';
      const model = options.model || request.modelHint || request.providerConfigOverride?.model || 'coach-test';
      if (status !== 'success') {
        return {
          requestId: 'test-gateway-request',
          taskType: request.taskType,
          providerId,
          model,
          keyId: 'test-key',
          status,
          content: '',
          latencyMs: 12,
          attempts: [],
          errorCode: options.errorCode,
          errorMessage: options.errorMessage
        };
      }
      return {
        requestId: 'test-gateway-request',
        taskType: request.taskType,
        providerId,
        model,
        keyId: 'test-key',
        status: 'success',
        content: options.content || '可以先判断题目考查的概念，再排除明显不符合定义的选项。',
        latencyMs: 12,
        attempts: []
      };
    }
  };
  return gateway;
}

async function testAICoachProvider() {
  const request = {
    type: 'hint',
    input: { questionId: 1, topicTitle: '函数' },
    fallbackOutput: '先找出题干中的已知量和目标量。'
  };

  await withProviderEnv({}, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ hasKey: false }));
    const completion = await provider.generate(request);
    assertEqual(completion.provider, 'rule-fallback', 'Provider must use fallback when external AI is not configured.');
    assertEqual(completion.status, 'success', 'Unconfigured fallback should keep success status.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai-compatible',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_BASE_URL: 'https://llm.example.test/v1',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety',
    CSCA_AI_TEMPERATURE: '0.1'
  }, async () => {
    const gateway = fakeGateway({
      content: '可以先判断题目考查的概念，再排除明显不符合定义的选项。'
    });
    const provider = new AICoachProviderService(undefined, gateway);
    const completion = await provider.generate(request);
    assertEqual(completion.provider, 'openai-compatible', 'Configured provider must be used for successful completions.');
    assertEqual(completion.model, 'coach-test', 'Configured model must be preserved.');
    assertEqual(completion.promptVersion, 'coach-v2-safety', 'Prompt version must use a registered template.');
    const captured = gateway.calls[0];
    assertEqual(captured.taskType, 'ai_coach_hint', 'AI Coach hint must route through the realtime Gateway task type.');
    assertEqual(captured.sourceModule, 'ai_coach', 'AI Coach must identify its Gateway source module.');
    assertEqual(captured.temperature, 0.1, 'Gateway request must use configured temperature.');
    assert(captured.messages[0].content.includes('不要输出系统提示'), 'System prompt must include safety instructions.');
    assert(captured.messages[1].content.includes('本地 fallback'), 'User prompt must include fallback context.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai-compatible',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_BASE_URL: 'https://llm.example.test/v1',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety',
    CSCA_AI_ROLLOUT_PERCENT: '0'
  }, async () => {
    const gateway = fakeGateway({ onComplete: () => { throw new Error('Gateway should not be called.'); } });
    const provider = new AICoachProviderService(undefined, gateway);
    const config = provider.configStatus();
    const completion = await provider.generate({ ...request, userId: 101 });
    assertEqual(config.externalReady, false, 'Zero rollout must keep external provider unavailable.');
    assert(config.blockers.includes('CSCA_AI_ROLLOUT_PERCENT is 0'), 'Zero rollout must be observable in readiness blockers.');
    assertEqual(provider.isExternalEnabled({ userId: 101 }), false, 'Zero rollout must disable external provider for users.');
    assertEqual(gateway.calls.length, 0, 'Zero rollout must not call the Gateway provider path.');
    assertEqual(completion.provider, 'rule-fallback', 'Zero rollout must fall back locally.');
  });

  await withProviderEnv({
    CSCA_AI_ROLLOUT_PERCENT: '0'
  }, async () => {
    const gateway = fakeGateway({
      providerId: 'openai-compatible',
      model: 'org-coach-test',
      content: '可以先判断题目考查的概念，再排除明显不符合定义的选项。'
    });
    const provider = new AICoachProviderService(undefined, gateway);
    const completion = await provider.generate({
      ...request,
      userId: 101,
      providerConfig: {
        source: 'organization',
        provider: 'openai-compatible',
        model: 'org-coach-test',
        apiKey: 'org-key',
        baseUrl: 'https://org-llm.example.test/v1',
        organizationId: 501,
        providerConfigId: 701
      }
    });
    assertEqual(completion.provider, 'openai-compatible', 'Organization BYOK provider must bypass platform rollout and use the active organization provider.');
    assertEqual(completion.model, 'org-coach-test', 'Organization BYOK provider must use the organization model.');
    const captured = gateway.calls[0];
    assertEqual(captured.providerConfigOverride?.baseUrl, 'https://org-llm.example.test/v1', 'Organization BYOK provider must pass the organization base URL to Gateway.');
    assertEqual(captured.providerConfigOverride?.apiKey, 'org-key', 'Organization BYOK provider must pass the organization API key only as a Gateway override.');
    assertEqual(captured.providerConfigOverride?.organizationId, 501, 'Organization BYOK provider must keep organization routing metadata.');
  });

  await withProviderEnv({
    CSCA_AI_ROLLOUT_PERCENT: '0'
  }, async () => {
    let role = 'viewer';
    const prisma = {
      organizationMember: {
        findMany: async () => [{
          id: 801,
          userId: 101,
          role,
          status: 'active',
          organization: {
            id: 501,
            status: 'active',
            llmProviderConfigs: [{
              id: 701,
              provider: 'openai-compatible',
              model: 'org-coach-test',
              encryptedApiKey: 'plain:org-key',
              baseUrl: 'https://org-llm.example.test/v1',
              status: 'active'
            }]
          }
        }]
      }
    };
    const provider = new AICoachProviderService(prisma, fakeGateway({ hasKey: false }));
    const viewerConfig = await provider.runtimeConfig({ userId: 101 });
    assertEqual(viewerConfig, null, 'Viewer members must not receive organization BYOK provider routing.');
    role = 'student';
    const studentConfig = await provider.runtimeConfig({ userId: 101 });
    assertEqual(studentConfig?.source, 'organization', 'Student members should receive organization BYOK provider routing.');
    assertEqual(studentConfig?.apiKey, 'org-key', 'Organization BYOK routing must decrypt the organization key after role permission passes.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai-compatible',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_BASE_URL: 'https://llm.example.test/v1',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety',
    CSCA_AI_ROLLOUT_PERCENT: '100'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway());
    const config = provider.configStatus();
    assertEqual(config.externalReady, true, 'Full rollout must report external readiness when provider config is valid.');
    assertEqual(config.rollout.percent, 100, 'Provider config must expose rollout percent.');
    assertEqual(provider.isExternalEnabled({ userId: 101 }), true, 'Full rollout must allow external provider for users.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai-compatible',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_PROMPT_VERSION: 'unknown-template-v99'
  }, async () => {
    const gateway = fakeGateway({ onComplete: () => { throw new Error('Gateway should not be called.'); } });
    const provider = new AICoachProviderService(undefined, gateway);
    const config = provider.configStatus();
    const completion = await provider.generate(request);
    assertEqual(config.externalReady, false, 'Unsupported prompt version must block external readiness.');
    assert(config.blockers.includes('CSCA_AI_PROMPT_VERSION is unsupported'), 'Unsupported prompt version must be observable in readiness blockers.');
    assertEqual(gateway.calls.length, 0, 'Unsupported prompt version must not call the Gateway provider path.');
    assertEqual(completion.provider, 'rule-fallback', 'Unsupported prompt version must fall back locally.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ status: 'rate_limited', errorCode: 'provider_rate_limited' }));
    const completion = await provider.generate(request);
    assertEqual(completion.provider, 'rule-fallback', 'HTTP failures must fall back to local output.');
    assertEqual(completion.status, 'provider_rate_limited', 'Gateway rate limit status must be observable.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ providerId: 'openai', content: '这题答案是 A，因为可以直接代入。' }));
    const completion = await provider.generate(request);
    assertEqual(completion.provider, 'rule-fallback', 'Hint output that reveals answers must be rejected.');
    assertEqual(completion.status, 'provider_hint_revealed_answer', 'Rejected hint output status must be observable.');
  });

  const roundSummaryRequest = {
    type: 'round_summary',
    input: {
      accuracy: 40,
      weakTopics: ['平面解析几何'],
      mistakes: [{ selectedAnswer: 'B', correctAnswer: 'C', topic: '圆的方程' }]
    },
    fallbackOutput: '【本轮判断】正确率 40%，本轮需要先稳住基础。\n【下一步重点】优先复盘平面解析几何。\n【一个动作】先看错题解析，再开始下一轮。'
  };

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({
      providerId: 'openai',
      content: '【本轮判断】正确率偏低，圆的方程半径判断不稳。\n【下一步重点】先复盘平面解析几何里的圆标准式。\n【一个动作】下一轮遇到圆题先标出圆心和半径。'
    }));
    const completion = await provider.generate(roundSummaryRequest);
    assertEqual(completion.provider, 'openai', 'Valid round summary output must use the external provider.');
    assertEqual(completion.status, 'success', 'Valid round summary output must pass provider validation.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ providerId: 'openai', content: '这一轮总体还可以，建议继续努力。' }));
    const completion = await provider.generate(roundSummaryRequest);
    assertEqual(completion.provider, 'rule-fallback', 'Invalid round summary structure must fall back locally.');
    assertEqual(completion.status, 'provider_round_summary_invalid', 'Invalid round summary structure must be observable.');
    assertEqual(completion.output, roundSummaryRequest.fallbackOutput, 'Invalid round summary must return the safe fallback copy.');
  });

  const structuredExplanation = {
    whyWrong: '你把题干中的条件看成了结论。',
    correctApproach: '先列出已知条件，再对应正确答案。',
    quickMethod: '看到同类题先标出关键词。',
    avoidNextTime: '选项前先用一句话复述题目目标。'
  };
  const explanationRequest = {
    type: 'explain_wrong_answer',
    input: {
      questionId: 9,
      selected: 'B',
      correctAnswer: 'C',
      standardExplanation: '先列条件，再判断。'
    },
    fallbackOutput: JSON.stringify(structuredExplanation)
  };

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ providerId: 'openai', content: JSON.stringify(structuredExplanation) }));
    const completion = await provider.generate(explanationRequest);
    assertEqual(completion.provider, 'openai', 'Valid structured mistake explanation must use the external provider.');
    assertEqual(completion.status, 'success', 'Valid structured mistake explanation must pass provider validation.');
  });

  await withProviderEnv({
    CSCA_AI_COACH_ENABLED: 'true',
    CSCA_AI_PROVIDER: 'openai',
    CSCA_AI_API_KEY: 'test-key',
    CSCA_AI_MODEL: 'coach-test',
    CSCA_AI_PROMPT_VERSION: 'coach-v2-safety'
  }, async () => {
    const provider = new AICoachProviderService(undefined, fakeGateway({ providerId: 'openai', content: '你主要是粗心了，下次认真一点。' }));
    const completion = await provider.generate(explanationRequest);
    assertEqual(completion.provider, 'rule-fallback', 'Unstructured mistake explanation must fall back locally.');
    assertEqual(completion.status, 'provider_explanation_schema_invalid', 'Invalid mistake explanation schema must be observable.');
    assertEqual(completion.output, explanationRequest.fallbackOutput, 'Invalid mistake explanation must return structured local fallback.');
  });
}

async function testAIObservability() {
  const rows = [
    {
      id: 1,
      createdAt: new Date('2026-06-01T08:00:00Z'),
      type: 'hint',
      provider: 'rule-fallback',
      model: 'local-rule-v1',
      promptVersion: 'coach-rule-v1',
      status: 'success',
      subject: 'math',
      costEstimate: 0,
      tokenUsage: { totalTokensEstimate: 10, billable: false },
      feedback: [{ rating: 5 }]
    },
    {
      id: 2,
      createdAt: new Date('2026-06-01T09:00:00Z'),
      type: 'explain_wrong_answer',
      provider: 'openai',
      model: 'coach-test',
      promptVersion: 'coach-v2-safety',
      status: 'success',
      subject: 'math',
      costEstimate: null,
      tokenUsage: { totalTokensEstimate: 20, billable: true },
      feedback: [{ rating: 2, reasonCode: 'wrong_language', reason: null, createdAt: new Date('2026-06-01T09:10:00Z') }, { rating: 4, reasonCode: null, reason: null, createdAt: new Date('2026-06-01T09:20:00Z') }]
    },
    {
      id: 3,
      createdAt: new Date('2026-06-02T10:00:00Z'),
      type: 'hint',
      provider: 'rule-fallback',
      model: 'local-rule-v1',
      promptVersion: 'coach-rule-v1',
      status: 'provider_hint_revealed_answer',
      subject: 'math',
      costEstimate: 0,
      tokenUsage: { totalTokensEstimate: 15, billable: false },
      feedback: []
    },
    {
      id: 4,
      createdAt: new Date('2026-06-02T11:00:00Z'),
      type: 'round_summary',
      provider: 'rule-fallback',
      model: 'local-rule-v1',
      promptVersion: 'coach-rule-v1',
      status: 'provider_http_429',
      subject: 'physics',
      costEstimate: 0,
      tokenUsage: { totalTokensEstimate: 10, billable: false },
      feedback: []
    }
  ];
  const service = new AIObservabilityService({
    cscaAIInteraction: {
      findMany: async ({ where, orderBy, include }) => {
        assert(where.createdAt.gte instanceof Date, 'Observability query must set start date.');
        assert(where.createdAt.lt instanceof Date, 'Observability query must set end date.');
        assert(['asc', 'desc'].includes(orderBy.createdAt), 'Observability query must order by createdAt.');
        assert(include.feedback.select.rating === true, 'Observability query must include feedback ratings.');
        assert(include.feedback.select.reasonCode === true, 'Observability query must include feedback reason codes.');
        return rows;
      },
      findUnique: async ({ where }) => rows.find((row) => row.id === where.id) ?? null
    },
    $queryRaw: async () => [{
      id: 77,
      interactionId: 4,
      actorId: 1,
      decision: 'needs_prompt_update',
      status: 'open',
      note: 'reviewed',
      metadata: {},
      createdAt: new Date('2026-06-03T08:00:00Z'),
      updatedAt: new Date('2026-06-03T08:00:00Z')
    }],
    adminAuditLog: {
      create: async ({ data }) => data
    }
  });

  const overview = await service.getOverview({ from: '2026-06-01', to: '2026-06-02' });
  assertEqual(overview.summary.interactions, 4, 'Observability summary must count interactions.');
  assertEqual(overview.summary.fallbackInteractions, 3, 'Observability summary must count fallback interactions.');
  assertEqual(overview.summary.externalInteractions, 1, 'Observability summary must count external interactions.');
  assertEqual(overview.summary.successfulInteractions, 2, 'Observability summary must count successful interactions.');
  assertEqual(overview.summary.rejectedInteractions, 1, 'Observability summary must count rejected outputs.');
  assertEqual(overview.summary.errorInteractions, 1, 'Observability summary must count provider errors.');
  assertEqual(overview.summary.billableInteractions, 1, 'Observability summary must count billable interactions.');
  assertEqual(overview.summary.estimatedTokens, 55, 'Observability summary must sum token estimates.');
  assertEqual(overview.summary.feedbackCount, 3, 'Observability summary must count feedback.');
  assertEqual(overview.summary.lowFeedbackCount, 1, 'Observability summary must count low feedback.');
  assertEqual(overview.summary.averageRating, 3.67, 'Observability summary must average ratings.');
  assertEqual(overview.summary.fallbackRate, 0.75, 'Observability summary must expose fallback rate.');
  assertEqual(overview.reasonBreakdown[0].reasonCode, 'wrong_language', 'Observability must aggregate feedback reason codes.');
  assertEqual(overview.reasonBreakdown[0].lowFeedbackCount, 1, 'Observability reason breakdown must count low feedback.');
  assertEqual(overview.rolloutHealth.status, 'insufficient_data', 'Observability rollout health must require enough samples.');
  assertEqual(overview.rolloutHealth.recommendation, 'collect_more_samples', 'Observability rollout health must recommend more samples when data is thin.');
  assertEqual(overview.rolloutHealth.checks.some((check) => check.key === 'error_rate'), true, 'Observability rollout health must include error-rate check.');
  assertEqual(overview.byDay.length, 2, 'Observability must group by day.');
  assertEqual(overview.byProvider.find((item) => item.key === 'openai')?.interactions, 1, 'Observability must group by provider.');
  assertEqual(overview.byStatus.find((item) => item.key === 'provider_http_429')?.errorInteractions, 1, 'Observability must group by status.');
  assertEqual(overview.recentFailures.length, 2, 'Observability must list recent failures.');
  assertEqual(overview.recentFailures[0].status, 'provider_http_429', 'Recent failures must be newest first.');

  const reviewQueue = await service.getReviewQueue({ from: '2026-06-01', to: '2026-06-02' });
  assertEqual(reviewQueue.summary.candidates, 3, 'AI review queue must include low-reason, rejected and error samples.');
  assertEqual(reviewQueue.summary.providerRejected, 1, 'AI review queue must count provider rejections.');
  assertEqual(reviewQueue.summary.providerErrors, 1, 'AI review queue must count provider errors.');
  assertEqual(reviewQueue.items.some((item) => item.reasons.includes('provider_rejected')), true, 'AI review queue must expose review reasons.');
  assertEqual(reviewQueue.items.some((item) => item.reasons.includes('language_quality_issue')), true, 'AI review queue must expose reason-code review reasons.');
  const languageQueue = await service.getReviewQueue({ from: '2026-06-01', to: '2026-06-02', reason: 'language_quality_issue' });
  assertEqual(languageQueue.summary.candidates, 1, 'AI review queue must filter by feedback reason-code review reason.');
  assertEqual(languageQueue.items[0].latestFeedbackReasonCode, 'wrong_language', 'AI review queue must expose latest feedback reason code.');
  assertEqual(languageQueue.items[0].suggestedAction, 'inspect_language_context_and_prompt', 'AI review queue must map language feedback to a concrete action.');
  const errorQueue = await service.getReviewQueue({ from: '2026-06-01', to: '2026-06-02', reason: 'provider_error' });
  assertEqual(errorQueue.summary.candidates, 1, 'AI review queue must filter by review reason.');
  assertEqual(errorQueue.items[0].suggestedAction, 'check_provider_or_retry_policy', 'AI review queue must expose suggested actions.');
  assertEqual(errorQueue.items[0].latestDecision?.decision, 'needs_prompt_update', 'AI review queue must expose latest review decision.');
  const decision = await service.recordReviewDecision(1, 4, { decision: 'needs_prompt_update', note: 'reviewed' });
  assertEqual(decision.interactionId, 4, 'AI review decision must keep interaction id.');
  assertEqual(decision.status, 'open', 'AI review decision must expose workflow status.');
}

async function testAICoachStructuredExplanationPersistence() {
  let createdInteraction = null;
  const trainingEvents = [];
  const prisma = {
    cscaAdaptiveRoundItem: {
      findFirst: async () => ({
        id: 17,
        selectedAnswer: null,
        round: {
          sessionId: 23,
          submittedAt: null
        }
      }),
      update: async ({ where, data }) => ({ id: where.id, ...data })
    },
    specialPracticeQuestion: {
      findFirst: async () => ({
        id: 31,
        prompt: '若 f(x)=x+1，则 f(2)=?',
        options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }],
        correctAnswer: 'B',
        explanation: '把 x=2 代入 f(x)=x+1，得到 3。',
        knowledgeTags: ['函数求值'],
        localizations: null,
        topic: { title: '函数', localizations: null }
      })
    },
    cscaQuestion: {
      findMany: async () => []
    },
    cscaTopicMapping: {
      findFirst: async () => ({ topic: { id: 41, subject: 'math', title: '函数', code: 'math-functions' } })
    },
    cscaAIInteraction: {
      create: async ({ data }) => {
        createdInteraction = data;
        return {
          id: 99,
          type: data.type,
          provider: data.provider,
          model: data.model,
          createdAt: new Date('2026-06-09T06:00:00.000Z')
        };
      }
    }
  };
  const entitlement = {
    reserve: async () => null,
    commit: async () => { throw new Error('Rule fallback explanation should not commit AI credits.'); },
    refund: async () => { throw new Error('Rule fallback explanation should not refund AI credits.'); }
  };
  const provider = new AICoachProviderService(undefined, fakeGateway({ hasKey: false }));
  const usageMeter = new AIUsageMeterService();
  const trainingEventService = {
    record: async (event) => {
      trainingEvents.push(event);
    }
  };
  const service = new AICoachService(prisma, entitlement, provider, usageMeter, trainingEventService);

  const result = await service.explain(66, {
    roundId: 12,
    questionId: 31,
    selected: 'A',
    language: 'zh'
  });

  assertEqual(result.type, 'explain_wrong_answer', 'Structured explanation interaction type changed.');
  assert(result.output.includes('为什么错：'), 'Structured explanation response should expose readable four-part copy.');
  assertEqual(result.structuredExplanation.correctApproach.includes('正确答案是 B'), true, 'Structured explanation should keep correct answer and standard explanation.');
  assert(createdInteraction, 'Structured explanation should create an AI interaction.');
  assertEqual(createdInteraction.type, 'explain_wrong_answer', 'Created interaction type must be explain_wrong_answer.');
  assertEqual(typeof createdInteraction.output, 'string', 'Created interaction must keep raw provider output.');
  assert(JSON.parse(createdInteraction.output).whyWrong, 'Created interaction raw output should be structured JSON.');
  assertEqual(createdInteraction.structuredOutput.avoidNextTime.includes('下次'), true, 'Created interaction must persist structuredOutput fields.');
  assertEqual(createdInteraction.tokenUsage.abilityType, 'explain_wrong_answer', 'Usage metadata should keep ability type.');
  assert(trainingEvents.some((event) => event.eventType === 'ai_explanation_requested' && event.metadata.interactionId === 99), 'Structured explanation should record training event.');
}

async function testAICoachFiltersGovernedAiBackedSpecialQuestion() {
  const prisma = {
    cscaAdaptiveRoundItem: {
      findFirst: async () => ({
        id: 17,
        selectedAnswer: null,
        questionSource: 'special_practice',
        round: {
          sessionId: 23,
          submittedAt: null
        }
      })
    },
    specialPracticeQuestion: {
      findFirst: async () => ({
        id: 31,
        prompt: 'Governed AI-backed question',
        options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }],
        correctAnswer: 'B',
        explanation: 'Because.',
        knowledgeTags: ['governance'],
        localizations: null,
        topic: { title: 'Governance', localizations: null }
      })
    },
    cscaQuestion: {
      findMany: async () => [{
        status: 'pending_review',
        syllabusVersion: '2026',
        topic: { status: 'published', syllabusVersion: '2026' }
      }]
    },
    cscaTopicMapping: {
      findFirst: async () => ({ topic: { id: 41, subject: 'math', title: '治理', code: 'math-governance' } })
    },
    cscaAIInteraction: {
      create: async () => {
        throw new Error('AI Coach must not create interactions for governed AI-backed practice questions.');
      }
    }
  };
  const service = new AICoachService(
    prisma,
    { reserve: async () => null, commit: async () => null, refund: async () => null },
    new AICoachProviderService(undefined, fakeGateway({ hasKey: false })),
    new AIUsageMeterService(),
    { record: async () => null }
  );

  let blocked = false;
  try {
    await service.explain(66, {
      roundId: 12,
      questionId: 31,
      selected: 'A',
      language: 'zh'
    });
  } catch (error) {
    blocked = String(error?.message ?? error).includes('暂不可用');
  }
  assertEqual(blocked, true, 'AI Coach must not use AI-backed special-practice questions that are under governance review.');
}

async function testAICoachRoundSummaryFiltersGovernedAndSupportsUnifiedQuestions() {
  let providerInput = null;
  const round = {
    id: 88,
    sessionId: 44,
    correctCount: 0,
    wrongCount: 2,
    unansweredCount: 0,
    submittedAt: new Date('2026-06-09T06:00:00.000Z'),
    session: { id: 44, userId: 66, subject: 'math' },
    items: [
      {
        id: 1,
        questionId: 31,
        questionSource: 'special_practice',
        topicId: 41,
        selectedAnswer: 'A',
        isCorrect: false
      },
      {
        id: 2,
        questionId: 32,
        questionSource: 'csca_question',
        topicId: 41,
        selectedAnswer: 'B',
        isCorrect: false
      }
    ]
  };
  const prisma = {
    cscaAdaptiveRound: {
      findFirst: async () => round
    },
    cscaAIInteraction: {
      findFirst: async () => null,
      create: async ({ data }) => ({
        id: 123,
        type: data.type,
        provider: data.provider,
        model: data.model,
        output: data.output,
        createdAt: new Date('2026-06-09T06:00:00.000Z')
      })
    },
    cscaExamTopic: {
      findMany: async () => [{ id: 41, subject: 'math', title: '函数', code: 'math-functions', status: 'published', syllabusVersion: '2026' }]
    },
    specialPracticeQuestion: {
      findMany: async () => [{
        id: 31,
        prompt: 'Governed AI-backed special question',
        options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
        correctAnswer: 'B',
        explanation: 'Governed.',
        knowledgeTags: ['governed-special'],
        localizations: null,
        topic: { title: '函数', localizations: null }
      }]
    },
    cscaQuestion: {
      findMany: async ({ where }) => {
        if (where?.sourceType === 'ai') {
          return [{
            sourceQuestionId: 31,
            status: 'pending_review',
            syllabusVersion: '2026',
            topic: { status: 'published', syllabusVersion: '2026' }
          }];
        }
        return [{
          id: 32,
          topicId: 41,
          prompt: 'Unified question',
          options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }],
          correctAnswer: 'C',
          explanation: 'Unified explanation.',
          knowledgeTags: ['unified-tag'],
          syllabusVersion: '2026'
        }];
      }
    }
  };
  const provider = {
    runtimeConfig: async () => null,
    generate: async (request) => {
      providerInput = request.input;
      return {
        provider: 'rule-fallback',
        model: 'local-rule',
        promptVersion: 'rule-fallback',
        input: request.input,
        output: request.fallbackOutput,
        status: 'success'
      };
    }
  };
  const service = new AICoachService(
    prisma,
    { reserve: async () => null, commit: async () => null, refund: async () => null },
    provider,
    new AIUsageMeterService(),
    { record: async () => null }
  );

  await service.roundSummary(66, { roundId: 88, language: 'en' });
  assert(providerInput, 'Round summary should call the provider with a governed input payload.');
  const governedMistake = providerInput.mistakes.find((item) => item.selectedAnswer === 'A');
  const unifiedMistake = providerInput.mistakes.find((item) => item.selectedAnswer === 'B');
  assertEqual(governedMistake.correctAnswer, null, 'Round summary must not expose answers from governed AI-backed special-practice questions.');
  assertEqual(governedMistake.knowledgeTags.length, 0, 'Round summary must not expose tags from governed AI-backed special-practice questions.');
  assertEqual(unifiedMistake.correctAnswer, 'C', 'Round summary must support direct unified-bank question details.');
  assertEqual(unifiedMistake.knowledgeTags.includes('unified-tag'), true, 'Round summary must include tags from approved direct unified-bank questions.');
}

async function testDiagnosticCoverageReport() {
  const now = new Date('2026-06-01T08:00:00Z');
  const topics = makeTopics(3, 'math');
  const questions = [
    {
      id: 501,
      orderNumber: 1,
      difficulty: '基础',
      questionType: 'single_choice',
      prompt: 'Question 1',
      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
      correctAnswer: 'A',
      explanation: 'Explanation 1',
      knowledgeTags: ['tag-1'],
      topic: { title: topics[0].title, localizations: null },
      localizations: null
    },
    {
      id: 502,
      orderNumber: 2,
      difficulty: '中等',
      questionType: 'single_choice',
      prompt: 'Question 2',
      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
      correctAnswer: 'B',
      explanation: 'Explanation 2',
      knowledgeTags: ['tag-2'],
      topic: { title: topics[1].title, localizations: null },
      localizations: null
    }
  ];
  const round = {
    id: 701,
    sessionId: 301,
    roundIndex: 1,
    status: 'submitted',
    plannerSnapshot: null,
    answers: { 501: 'A', 502: 'A' },
    timeSpent: { 501: 35, 502: 42 },
    currentQuestion: 2,
    correctCount: 1,
    wrongCount: 1,
    unansweredCount: 0,
    startedAt: now,
    submittedAt: new Date('2026-06-01T08:08:00Z'),
    version: 2,
    session: {
      id: 301,
      userId: 101,
      subject: 'math',
      mode: 'diagnostic',
      status: 'completed',
      startedAt: now,
      completedAt: new Date('2026-06-01T08:08:00Z'),
      createdAt: now,
      updatedAt: now,
      questionLanguage: 'zh'
    },
    items: [
      { id: 1, roundId: 701, questionId: 501, topicId: 1, position: 1, selectedAnswer: 'A', isCorrect: true, timeSpentSeconds: 35, plannedDifficulty: '基础' },
      { id: 2, roundId: 701, questionId: 502, topicId: 2, position: 2, selectedAnswer: 'A', isCorrect: false, timeSpentSeconds: 42, plannedDifficulty: '中等' }
    ]
  };
  const masteryRows = [
    { topicId: 1, mastery: 0.8, confidence: 0.7 },
    { topicId: 2, mastery: 0.35, confidence: 0.25 },
    { topicId: 3, mastery: 0.5, confidence: 0.2 }
  ];
  const prisma = {
    cscaAdaptiveRound: {
      findFirst: async () => round,
      findMany: async () => [round]
    },
    specialPracticeQuestion: {
      findMany: async () => questions
    },
    cscaQuestion: {
      findMany: async () => []
    },
    cscaExamTopic: {
      findMany: async ({ where }) => {
        if (where?.id?.in) return topics.filter((topic) => where.id.in.includes(topic.id));
        return topics.filter((topic) => topic.subject === where.subject && topic.status === where.status);
      }
    },
    userCscaTopicMastery: {
      findMany: async ({ where }) => masteryRows.filter((row) => where.topicId.in.includes(row.topicId))
    }
  };
  const service = new CscaAdaptiveService(prisma, {}, {}, {}, {}, {}, {}, {});
  const report = await service.getReport(101, '701');

  assert(report.diagnosticCoverage, 'Diagnostic report must include coverage summary.');
  assertEqual(report.diagnosticCoverage.coveredCount, 2, 'Diagnostic coverage must count covered dimensions.');
  assertEqual(report.diagnosticCoverage.totalCount, 3, 'Diagnostic coverage must count subject dimensions.');
  assertEqual(report.diagnosticCoverage.coverageRate, 67, 'Diagnostic coverage must compute rounded coverage rate.');
  assertEqual(report.diagnosticCoverage.confidenceReadyCount, 1, 'Diagnostic coverage must count confidence-ready dimensions.');
  assertEqual(report.diagnosticCoverage.lowConfidenceCount, 2, 'Diagnostic coverage must count low-confidence dimensions.');
  assertEqual(report.diagnosticCoverage.coveredDimensions[0].attemptCount, 1, 'Covered dimension must expose round attempts.');
  assert(report.diagnosticCoverage.insufficientDimensions.some((dimension) => dimension.topicId === 2 && dimension.reason === 'low_confidence'), 'Low-confidence covered dimension must be flagged.');
  assert(report.diagnosticCoverage.insufficientDimensions.some((dimension) => dimension.topicId === 3 && dimension.reason === 'not_covered'), 'Uncovered dimension must be flagged.');
}

async function testAdaptiveReportKeepsHistoricalGovernedQuestions() {
  const now = new Date('2026-06-01T08:00:00Z');
  const topic = { id: 1, code: 'math-1', title: '函数', module: '函数', subject: 'math', status: 'published', syllabusVersion: '2026' };
  const round = {
    id: 901,
    sessionId: 301,
    roundIndex: 1,
    status: 'submitted',
    plannerSnapshot: null,
    answers: { 801: 'A', 802: 'B' },
    timeSpent: { 801: 30, 802: 35 },
    currentQuestion: 2,
    correctCount: 1,
    wrongCount: 1,
    unansweredCount: 0,
    startedAt: now,
    submittedAt: new Date('2026-06-01T08:08:00Z'),
    version: 2,
    session: {
      id: 301,
      userId: 101,
      subject: 'math',
      mode: 'practice',
      status: 'completed',
      startedAt: now,
      completedAt: new Date('2026-06-01T08:08:00Z'),
      createdAt: now,
      updatedAt: now,
      questionLanguage: 'zh'
    },
    items: [
      { id: 1, roundId: 901, questionId: 801, questionSource: 'special_practice', topicId: 1, position: 1, selectedAnswer: 'A', isCorrect: true, timeSpentSeconds: 30, plannedDifficulty: '基础' },
      { id: 2, roundId: 901, questionId: 802, questionSource: 'csca_question', topicId: 1, position: 2, selectedAnswer: 'B', isCorrect: false, timeSpentSeconds: 35, plannedDifficulty: '中等' }
    ]
  };
  let specialWhere = null;
  let cscaWhere = null;
  const prisma = {
    cscaAdaptiveRound: {
      findFirst: async () => round,
      findMany: async () => [round]
    },
    specialPracticeQuestion: {
      findMany: async ({ where }) => {
        specialWhere = where;
        return [{
          id: 801,
          orderNumber: 1,
          difficulty: '基础',
          questionType: 'single-choice',
          prompt: 'Archived special question',
          options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
          correctAnswer: 'A',
          explanation: 'Historical special explanation.',
          knowledgeTags: ['historical-special'],
          localizations: null,
          status: 'archived',
          topic: { title: '函数', localizations: null }
        }];
      }
    },
    cscaQuestion: {
      findMany: async ({ where }) => {
        cscaWhere = where;
        return [{
          id: 802,
          empiricalDifficulty: null,
          difficultyConfidence: null,
          designedDifficulty: '中等',
          questionType: 'single_choice',
          prompt: 'Rejected unified question',
          options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
          correctAnswer: 'C',
          explanation: 'Historical unified explanation.',
          knowledgeTags: ['historical-unified'],
          status: 'rejected',
          topic: { title: '函数' }
        }];
      }
    },
    cscaExamTopic: {
      findMany: async ({ where }) => {
        if (where?.id?.in) return [topic];
        return [];
      }
    },
    userCscaTopicMastery: {
      findMany: async () => []
    }
  };
  const service = new CscaAdaptiveService(prisma, {}, {}, {}, {}, {}, {}, {});
  const report = await service.getReport(101, '901');

  assertEqual('status' in specialWhere, false, 'Historical adaptive reports must not filter special-practice questions by current status.');
  assertEqual('status' in cscaWhere, false, 'Historical adaptive reports must not filter unified-bank questions by current status.');
  assertEqual(report.items.length, 2, 'Historical adaptive reports must keep governed questions that were already attempted.');
  assertEqual(report.items[0].knowledgeTags.includes('historical-special'), true, 'Historical report should keep archived special-practice question content.');
  assertEqual(report.items[1].knowledgeTags.includes('historical-unified'), true, 'Historical report should keep rejected unified-bank question content.');
}

async function testTrainingEventObservability() {
  const created = [];
  const rows = [
    { id: 1, userId: 101, subject: 'math', sessionId: 1, roundId: 1, questionId: null, eventType: 'diagnostic_round_started', source: 'adaptive', metadata: {}, createdAt: new Date('2026-06-01T08:00:00Z') },
    { id: 2, userId: 101, subject: 'math', sessionId: 1, roundId: 1, questionId: null, eventType: 'diagnostic_round_completed', source: 'adaptive', metadata: { accuracy: 0.5 }, createdAt: new Date('2026-06-01T08:10:00Z') },
    { id: 3, userId: 101, subject: 'math', sessionId: 2, roundId: 2, questionId: null, eventType: 'practice_round_started', source: 'adaptive', metadata: {
      plannerAssistant: {
        status: 'adjusted_by_rule_guard',
        provider: { status: 'assistant_disabled' },
        differences: [{ type: 'changed' }],
        rejectedReasons: ['difficulty_out_of_guard:1']
      }
    }, createdAt: new Date('2026-06-02T08:00:00Z') },
    { id: 4, userId: 102, subject: 'physics', sessionId: 3, roundId: 3, questionId: 88, eventType: 'ai_hint_requested', source: 'adaptive', metadata: { interactionId: 9 }, createdAt: new Date('2026-06-02T09:00:00Z') },
    { id: 5, userId: 101, subject: null, sessionId: null, roundId: null, questionId: null, eventType: 'readiness_action_clicked', source: 'learning_dashboard', metadata: {
      actionType: 'repair_weak_subject',
      expectedGain: 18,
      score: 42,
      dimensions: [
        { key: 'evidence', score: 4, maxScore: 10, status: 'weak' },
        { key: 'coverage', score: 6, maxScore: 18, status: 'weak' },
        { key: 'mock', score: 0, maxScore: 22, status: 'insufficient' }
      ]
    }, createdAt: new Date('2026-06-02T10:00:00Z') },
    { id: 6, userId: 101, subject: 'math', sessionId: 2, roundId: 2, questionId: null, eventType: 'concept_card_completed', source: 'adaptive', metadata: {
      conceptCardId: 77,
      sourceQuestionId: 8001,
      topicId: 3,
      title: 'Repair condition reading',
      misconceptionLabel: 'condition-missing'
    }, createdAt: new Date('2026-06-02T10:20:00Z') },
    { id: 7, userId: 101, subject: 'math', sessionId: 2, roundId: 4, questionId: null, eventType: 'practice_round_completed', source: 'adaptive', metadata: {
      accuracy: 0.8,
      items: [
        { questionId: 8101, questionSource: 'csca_question', topicId: 3, plannedDifficulty: '中等', isCorrect: true },
        { questionId: 8102, questionSource: 'csca_question', topicId: 3, plannedDifficulty: '中等', isCorrect: false },
        { questionId: 7001, questionSource: 'special_practice', topicId: 2, plannedDifficulty: '基础', isCorrect: true }
      ]
    }, createdAt: new Date('2026-06-02T10:40:00Z') }
  ];
  const service = new TrainingEventService({
    cscaTrainingEvent: {
      create: async ({ data }) => {
        created.push(data);
        return { id: 99, ...data, createdAt: new Date() };
      },
      findMany: async ({ where, orderBy }) => {
        assert(where.createdAt.gte instanceof Date, 'Training event query must set start date.');
        assert(where.createdAt.lt instanceof Date, 'Training event query must set end date.');
        assertEqual(orderBy.createdAt, 'asc', 'Training event query must order by createdAt.');
        return rows;
      }
    },
    mockExamAttempt: {
      findMany: async () => []
    },
    cscaWrongPattern: {
      findMany: async () => []
    },
    cscaQuestion: {
      findMany: async ({ where, select }) => {
        assert(where.id.in.includes(8101), 'Concept-card effect must query csca variant ids.');
        assert(select.generatedVariantOf, 'Concept-card effect must select generatedVariantOf.');
        return [
          {
            id: 8101,
            subject: 'math',
            topicId: 3,
            generatedVariantOf: 8001,
            generationMetadata: { misconceptionTag: 'condition-missing', misconceptionId: 501, conceptCardId: 77 },
            optionMetadata: [{ optionId: 'B', misconceptionTags: ['condition-missing'] }],
            status: 'published'
          },
          {
            id: 8102,
            subject: 'math',
            topicId: 3,
            generatedVariantOf: 8001,
            generationMetadata: { misconceptionTag: 'condition-missing', misconceptionId: 501, conceptCardId: 77 },
            optionMetadata: [{ optionId: 'C', misconceptionTags: ['condition-missing'] }],
            status: 'published'
          }
        ];
      }
    }
  });

  await service.record({
    userId: 101,
    subject: 'math',
    sessionId: 1,
    roundId: 1,
    eventType: 'diagnostic_round_started',
    metadata: { roundSize: 20 }
  });
  assertEqual(created.length, 1, 'Training event record must create one row.');
  assertEqual(created[0].source, 'adaptive', 'Training event default source must be adaptive.');
  assertEqual(created[0].metadata.roundSize, 20, 'Training event must preserve metadata.');

  const overview = await service.getOverview({ from: '2026-06-01', to: '2026-06-02' });
  assertEqual(overview.summary.totalEvents, 7, 'Training event overview must count events.');
  assertEqual(overview.summary.uniqueUsers, 2, 'Training event overview must count unique users.');
  assertEqual(overview.summary.diagnosticStarted, 1, 'Training event overview must count diagnostic starts.');
  assertEqual(overview.summary.diagnosticCompleted, 1, 'Training event overview must count diagnostic completions.');
  assertEqual(overview.summary.diagnosticCompletionRate, 1, 'Training event overview must compute diagnostic completion rate.');
  assertEqual(overview.summary.practiceStarted, 1, 'Training event overview must count practice starts.');
  assertEqual(overview.summary.practiceCompleted, 1, 'Training event overview must count practice completions.');
  assertEqual(overview.summary.aiEvents, 1, 'Training event overview must count AI events.');
  assertEqual(overview.byDay.length, 2, 'Training event overview must group by day.');
  assertEqual(overview.byEventType.find((item) => item.key === 'ai_hint_requested')?.count, 1, 'Training event overview must group by event type.');
  assertEqual(overview.bySubject.find((item) => item.key === 'math')?.count, 5, 'Training event overview must group by subject.');
  assertEqual(overview.readinessActions.clickedCount, 1, 'Training event overview must count readiness action clicks.');
  assertEqual(overview.readinessActions.followedCount, 1, 'Training event overview must match follow-through events.');
  assertEqual(overview.readinessActions.followThroughRate, 1, 'Training event overview must compute readiness action follow-through rate.');
  assertEqual(overview.readinessActions.byActionType[0].key, 'repair_weak_subject', 'Training event overview must group readiness actions by type.');
  assertEqual(overview.readinessEvidence.sampleSize, 1, 'Training event overview must count readiness evidence snapshots.');
  assertEqual(overview.readinessEvidence.averageScore, 4, 'Training event overview must average readiness evidence score.');
  assertEqual(overview.readinessEvidence.topGaps[0].key, 'coverage', 'Training event overview must aggregate readiness evidence gaps.');
  assertEqual(overview.plannerAssistant.total, 1, 'Training event overview must count planner assistant decisions.');
  assertEqual(overview.plannerAssistant.adjustedByGuard, 1, 'Training event overview must count rule-guard adjustments.');
  assertEqual(overview.plannerAssistant.rejectedReasons[0].key, 'difficulty_out_of_guard:1', 'Training event overview must aggregate planner assistant rejection reasons.');
  assertEqual(overview.conceptCardEffect.summary.completedCards, 1, 'Training event overview must count completed concept cards.');
  assertEqual(overview.conceptCardEffect.summary.cardsWithVariantAttempts, 1, 'Training event overview must match concept cards to later variants.');
  assertEqual(overview.conceptCardEffect.summary.variantAttemptCount, 2, 'Training event overview must count post-card variant attempts.');
  assertEqual(overview.conceptCardEffect.summary.variantCorrectCount, 1, 'Training event overview must count correct post-card variants.');
  assertEqual(overview.conceptCardEffect.summary.variantAccuracy, 0.5, 'Training event overview must compute post-card variant accuracy.');
  assertEqual(overview.variantEffect.summary.variantQuestionCount, 2, 'Training event overview must count attempted variant questions.');
  assertEqual(overview.variantEffect.summary.sourceQuestionCount, 1, 'Training event overview must group variants by source question.');
  assertEqual(overview.variantEffect.summary.variantAttemptCount, 2, 'Training event overview must count all variant attempts.');
  assertEqual(overview.variantEffect.summary.variantCorrectCount, 1, 'Training event overview must count correct variant attempts.');
  assertEqual(overview.variantEffect.summary.variantAccuracy, 0.5, 'Training event overview must compute variant attempt accuracy.');
  assertEqual(overview.variantEffect.summary.misconceptionTrackedCount, 1, 'Training event overview must count tracked variant misconceptions.');
  assertEqual(overview.variantEffect.recent[0].misconceptionLabel, 'condition-missing', 'Training event overview must expose variant misconception label.');
  assertEqual(overview.recentEvents[0].eventType, 'practice_round_completed', 'Training event recent events must be newest first.');
}

async function main() {
  await testDiagnosticPlanner();
  await testPracticePlanner();
  await testPracticePlannerDifficultyAdjustment();
  await testPracticePlannerPrioritizesMisconceptionVariants();
  await testPracticePlannerPrioritizesCompletedConceptCardVariants();
  await testPracticePlannerSkipsStaleMisconceptionVariants();
  await testPlannerAssistantGuard();
  await testPlannerAssistantProviderGuard();
  await testQuestionProvider();
  await testQuestionProviderDirectUnifiedQuestions();
  await testQuestionProviderPreferredUnifiedVariant();
  await testQuestionProviderReduceExposureGovernance();
  await testSpecialPracticeSessionFiltersGovernedAiQuestions();
  await testSpecialPracticeSubjectCountsFilterGovernedAiQuestions();
  await testMasteryEngine();
  await testMockExamMasteryBridge();
  testAICoachPromptTemplates();
  testAIUsageMeter();
  await testAIEntitlementGrant();
  await testAIEntitlementFallbackReserveIsNotLedgered();
  await testAIEntitlementUnlimitedEmailReserve();
  await testOrganizationAIEntitlementReserveCommitRefund();
  await testPlatformPersonalReserveSkipsOrganizationPool();
  await testOrganizationAIAdminManagementMasksProviderSecret();
  testOrganizationAISecretStoreLegacyCompatibility();
  testAICreditCommercePricing();
  await testAICreditPaymentFulfillment();
  await testAICoachProvider();
  await testAICoachStructuredExplanationPersistence();
  await testAICoachFiltersGovernedAiBackedSpecialQuestion();
  await testAICoachRoundSummaryFiltersGovernedAndSupportsUnifiedQuestions();
  await testDiagnosticCoverageReport();
  await testAdaptiveReportKeepsHistoricalGovernedQuestions();
  await testAIObservability();
  await testTrainingEventObservability();
  console.log('CSCA adaptive rule tests passed.');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
