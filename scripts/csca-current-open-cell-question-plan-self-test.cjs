require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  QuestionPromptBuilderService,
  questionPromptCharacterBudgetForPlanTemplate
} = require('../backend/src/ai-questioning/question-prompt-builder.service');
const {
  questionGenerationMaxTokensForBlueprint,
  questionGenerationReasoningPolicyFor
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const {
  SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
  SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor,
  subjectPracticeQuestionPlanGateFor,
  validateSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  subjectPracticeClassifyTaskFamily
} = require('../backend/src/ai-questioning/subject-practice-task-family-policy');

function assert(condition, message) {
  if (!condition) throw new Error(`current open-cell QuestionPlan self-test failed: ${message}`);
}

function promptPreview(fixture, questionPlan) {
  const targetDifficulty = fixture.difficulty || 'medium';
  const targetProfile = {
    gapKey: fixture.gapKey,
    reason: 'coverage',
    source: 'fixture',
    neededCount: 4,
    readingLoad: 'low',
    questionForm: fixture.questionForm,
    cognitiveSkill: fixture.cognitiveSkill,
    difficultyBand: targetDifficulty,
    calculationLoad: targetDifficulty === 'basic' ? 'light' : 'medium',
    distractorTypes: ['single_rule_only', 'reversed_relation'],
    commonMisconceptions: ['definition_only', 'one_relation_only'],
    generationStrategy: {
      schemaVersion: 'mock-exam-generation-strategy-v1',
      promptChecklist: ['instantiate the exact task family', 'show both evidence groups'],
      bannedStemPatterns: ['generic definition recall'],
      reviewerEvidenceTargets: ['two linked relations']
    }
  };
  const styleProfile = {
    id: 999,
    profileVersion: 'fixture-v1',
    confidence: 'medium',
    sampleSize: 4,
    scopeType: 'topic',
    profile: {
      generationGuidelines: Array.from({ length: 12 }, (_, index) => `fixture style guideline ${index + 1}`),
      reviewerGuidelines: Array.from({ length: 12 }, (_, index) => `fixture reviewer guideline ${index + 1}`),
      commonQuestionForms: [fixture.questionForm],
      commonCognitiveSkills: [fixture.cognitiveSkill],
      readingLoadDistribution: { low: 1 },
      calculationLoadDistribution: { medium: 1 },
      optionPatterns: { count: 4 },
      stemPatterns: { shape: 'fixture' },
      similarityRiskSignals: ['do not copy source wording']
    }
  };
  const built = new QuestionPromptBuilderService().build({
    id: fixture.cellId,
    subject: fixture.subject,
    topicId: fixture.topicId,
    topicCode: fixture.topicCode,
    topicModule: fixture.topicModule,
    topicTitle: fixture.topicTitle,
    syllabusVersion: '2026',
    examScope: fixture.examScope,
    allowedQuestionTypes: ['single_choice'],
    difficultyRange: [targetDifficulty],
    excludedScope: [],
    difficulty: targetDifficulty,
    questionType: 'single_choice',
    skill: fixture.cognitiveSkill,
    constraints: {
      generationSource: 'subject_practice_production_matrix',
      targetProfile,
      styleProfile,
      expansion: {
        generationMode: 'subject_practice_production_matrix',
        productionCellId: fixture.cellId,
        questionPlan
      }
    }
  });
  const totalPromptCharacters = built.messages.reduce((sum, message) => sum + String(message.content ?? '').length, 0);
  const model = 'deepseek-v4-flash';
  const costBlueprint = built.blueprint || {
    ...fixture,
    constraints: {
      targetProfile,
      expansion: { questionPlan }
    }
  };
  const reasoningPolicy = questionGenerationReasoningPolicyFor(costBlueprint, model);
  return {
    built,
    totalPromptCharacters,
    budget: questionPromptCharacterBudgetForPlanTemplate(questionPlan.planTemplate),
    executionCostPolicy: {
      model,
      ...reasoningPolicy,
      outputTokenCeiling: questionGenerationMaxTokensForBlueprint(costBlueprint, model)
    }
  };
}

function evaluateFixture(fixture) {
  const targetDifficulty = fixture.difficulty || 'medium';
  const questionPlan = buildSubjectPracticeQuestionPlan({
    subject: fixture.subject,
    topicId: fixture.topicId,
    topicTitle: fixture.topicTitle,
    productionCellId: fixture.cellId,
    targetDifficulty,
    taskFamily: fixture.taskFamily
  });
  assert(questionPlan, `${fixture.subject} cell #${fixture.cellId} must build a QuestionPlan`);
  assert(questionPlan.planTemplate === fixture.planTemplate, `${fixture.subject} template drifted to ${questionPlan.planTemplate}`);
  assert(validateSubjectPracticeQuestionPlan(questionPlan).valid, `${fixture.subject} plan must validate`);
  if (fixture.taskFamily === 'elementary_function_exp_log_ordering') {
    assert(questionPlan.renderConstraints.requireExpLogOrderingArchetypeRotation === true, 'exp/log plan must require archetype rotation');
    assert(questionPlan.renderConstraints.minimumStructuralAxesChanged === 2, 'exp/log plan must require two structural-axis changes');
    assert(questionPlan.renderConstraints.expLogOrderingArchetypes.length === 4, 'exp/log plan must expose four bounded archetypes');
  }
  if (fixture.taskFamily === 'elementary_function_direct_property') {
    assert(questionPlan.renderConstraints.requireBasicElementarySingleObjectSingleTarget === true, 'basic elementary plan must require one object and one target');
    assert(questionPlan.renderConstraints.forbidBasicElementaryEquationSolve === true, 'basic elementary plan must forbid equation solving');
    assert(questionPlan.renderConstraints.forbidBasicElementaryOrderingChain === true, 'basic elementary plan must forbid ordering chains');
    assert(questionPlan.renderConstraints.maxFunctionPropertyStack === 1, 'basic elementary plan must cap the property stack at one');
  }

  const shadowGate = subjectPracticeQuestionPlanGateFor({
    subject: fixture.subject,
    topicTitle: fixture.topicTitle,
    productionCellId: fixture.cellId,
    targetDifficulty,
    taskFamily: fixture.taskFamily,
    questionPlan,
    env: { [SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]: 'true' }
  });
  assert(shadowGate.mode === 'disabled_shadow' && shadowGate.cellAllowed === false, `${fixture.subject} must stay shadow-only without an allowlist`);
  const allowedGate = subjectPracticeQuestionPlanGateFor({
    subject: fixture.subject,
    topicTitle: fixture.topicTitle,
    productionCellId: fixture.cellId,
    targetDifficulty,
    taskFamily: fixture.taskFamily,
    questionPlan,
    env: {
      [SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]: 'true',
      [SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]: String(fixture.cellId)
    }
  });
  assert(allowedGate.mode === 'plan_required' && allowedGate.generationAllowed === true, `${fixture.subject} allowlisted gate must require a valid plan`);

  const positive = subjectPracticeQuestionPlanAdherenceFor(questionPlan, fixture.positiveCandidate);
  const negative = subjectPracticeQuestionPlanAdherenceFor(questionPlan, fixture.negativeCandidate);
  assert(positive.adheres === true, `${fixture.subject} positive fixture must adhere: ${positive.failureCodes.join(',')}`);
  assert(negative.adheres === false && negative.failureCodes.includes(fixture.expectedNegativeCode), `${fixture.subject} negative fixture must hit ${fixture.expectedNegativeCode}`);
  if (fixture.historicalLiveNegativeCandidate) {
    const historicalNegative = subjectPracticeQuestionPlanAdherenceFor(questionPlan, fixture.historicalLiveNegativeCandidate);
    assert(historicalNegative.adheres === false, `${fixture.subject} historical live negative fixture must be rejected`);
    assert(historicalNegative.failureCodes.includes(fixture.historicalLiveNegativeCode), `${fixture.subject} historical live negative fixture must hit ${fixture.historicalLiveNegativeCode}: ${historicalNegative.failureCodes.join(',')}`);
  }
  assert(subjectPracticeClassifyTaskFamily({
    subject: fixture.subject,
    topicTitle: fixture.topicTitle,
    prompt: fixture.positiveCandidate.prompt,
    explanation: fixture.positiveCandidate.explanation,
    options: fixture.positiveCandidate.options
  }) === fixture.taskFamily, `${fixture.subject} positive fixture must classify to ${fixture.taskFamily}`);
  if (fixture.additionalClassificationCandidate) {
    assert(subjectPracticeClassifyTaskFamily({
      subject: fixture.subject,
      topicTitle: fixture.topicTitle,
      prompt: fixture.additionalClassificationCandidate.prompt,
      explanation: fixture.additionalClassificationCandidate.explanation,
      options: fixture.additionalClassificationCandidate.options
    }) === fixture.taskFamily, `${fixture.subject} additional live-shape fixture must classify to ${fixture.taskFamily}`);
  }

  const preview = promptPreview(fixture, questionPlan);
  const audit = preview.built.metadata.promptAudit;
  assert(preview.totalPromptCharacters <= preview.budget, `${fixture.subject} prompt ${preview.totalPromptCharacters} exceeds budget ${preview.budget}`);
  assert(audit.questionPlanSupersedesTopicGuidance === true, `${fixture.subject} calibrated plan must suppress duplicate topic guidance`);
  assert(audit.questionPlanSupersedesStyleReference === true, `${fixture.subject} calibrated plan must suppress verbose style payload`);
  assert(audit.styleProfilePlacement === 'omitted_calibrated_question_plan_authoritative', `${fixture.subject} style payload must be omitted from provider prompt`);
  assert(audit.dynamicSystemSections.subjectPracticeTopicGuidance === 0, `${fixture.subject} duplicate topic guidance length must be zero`);
  assert(preview.built.messages[0].content.includes(fixture.requiredGuidancePhrase), `${fixture.subject} compact prompt must retain plan-specific guidance`);
  const compactBasicElementary = fixture.taskFamily === 'elementary_function_direct_property';
  assert(preview.executionCostPolicy.policyVersion === (compactBasicElementary ? 'question-generation-reasoning-effort-v3' : 'question-generation-reasoning-effort-v2'), `${fixture.subject} reasoning policy version drifted`);
  assert(preview.executionCostPolicy.thinking === (compactBasicElementary ? 'disabled' : 'enabled'), `${fixture.subject} thinking policy drifted`);
  assert(preview.executionCostPolicy.reasoningEffort === (compactBasicElementary ? undefined : 'low'), `${fixture.subject} reasoning effort drifted`);
  assert(compactBasicElementary ? preview.executionCostPolicy.temperature != null : preview.executionCostPolicy.temperature == null, `${fixture.subject} temperature policy drifted`);
  assert(preview.executionCostPolicy.outputTokenCeiling === (compactBasicElementary ? 3000 : 8000), `${fixture.subject} output token ceiling drifted`);

  return {
    subject: fixture.subject,
    cellId: fixture.cellId,
    taskFamily: fixture.taskFamily,
    planTemplate: fixture.planTemplate,
    shadowMode: shadowGate.mode,
    allowlistedMode: allowedGate.mode,
    positiveAdheres: positive.adheres,
    negativeFailureCodes: negative.failureCodes,
    promptCharacters: preview.totalPromptCharacters,
    promptBudget: preview.budget,
    promptBudgetStatus: 'passed',
    reasoningPolicyVersion: preview.executionCostPolicy.policyVersion,
    reasoningEffort: preview.executionCostPolicy.reasoningEffort,
    outputTokenCeiling: preview.executionCostPolicy.outputTokenCeiling,
    topicGuidanceSuperseded: audit.questionPlanSupersedesTopicGuidance,
    styleReferenceSuperseded: audit.questionPlanSupersedesStyleReference
  };
}

function main() {
  const fixtures = [
    {
      subject: 'physics', cellId: 19, topicId: 91, topicCode: 'P-OPT-001', topicModule: 'Optics', topicTitle: '几何光学',
      examScope: 'Use lens and refraction relations in text-complete situations.', gapKey: 'physics-optics-medium',
      questionForm: 'calculation_application', cognitiveSkill: 'standard_application', taskFamily: 'waves_optics_interference_refraction',
      planTemplate: 'physics_medium_optics_two_relation_v1', expectedNegativeCode: 'candidate_plan_physics_unseen_diagram_forbidden',
      requiredGuidancePhrase: 'make the optical setup complete in text',
      positiveCandidate: {
        prompt: '一凸透镜焦距 f=10 cm，物体位于主光轴上且物距 u=30 cm。物体向透镜靠近 5 cm 后，下列关于实像的像距和大小变化判断正确的是（ ）',
        options: [{ id: 'A', text: '像距增大，像变大' }, { id: 'B', text: '像距减小，像变小' }],
        explanation: '由薄透镜公式 1/f=1/u+1/v，物距仍大于 2f，因此仍成倒立实像；物体靠近时 u 减小，所以 v 增大且放大率增大，故像变大。'
      },
      negativeCandidate: {
        prompt: '如图所示，一凸透镜成像。下列说法正确的是（ ）',
        options: [{ id: 'A', text: '像距增大' }, { id: 'B', text: '像距减小' }],
        explanation: '根据图中物距和焦距关系判断。'
      }
    },
    {
      subject: 'chemistry', cellId: 36, topicId: 49, topicCode: 'C-CLS-001', topicModule: 'Foundations', topicTitle: '物质分类与状态变化',
      examScope: 'Classify substances and physical or chemical changes using concrete evidence.', gapKey: 'chemistry-classification-medium',
      questionForm: 'concept_judgement', cognitiveSkill: 'concept_discrimination', taskFamily: 'classification_state_change_evidence_judgement',
      planTemplate: 'chemistry_medium_classification_evidence_v1', expectedNegativeCode: 'candidate_plan_chemistry_definition_only_classification_forbidden',
      requiredGuidancePhrase: 'name a concrete material, mixture, or two-step process',
      positiveCandidate: {
        prompt: '将纯净的冰先熔化成水，再通电分解，观察到两极分别产生气泡。下列关于物质分类与变化类别的判断正确的是（ ）',
        options: [{ id: 'A', text: '熔化是物理变化，通电分解是化学变化，水是化合物' }, { id: 'B', text: '两步都是物理变化，水是混合物' }],
        explanation: '熔化前后仍是水，没有生成新物质；通电后产生氢气和氧气两种新物质，因此是化学变化。水由两种元素组成且是纯净物，所以属于化合物。'
      },
      negativeCandidate: {
        prompt: '下列物质中属于化合物的是（ ）',
        options: [{ id: 'A', text: '空气' }, { id: 'B', text: '水' }],
        explanation: '根据化合物的定义判断。'
      }
    },
    {
      subject: 'math', cellId: 353, topicId: 35, topicCode: 'M-EF-001', topicModule: 'Functions', topicTitle: '基本初等函数（指数、对数、幂函数）',
      examScope: 'Compare concrete exponential, logarithmic, and power values using exact transformations and bounds.', gapKey: 'math-elementary-function-medium',
      questionForm: 'concept_judgement', cognitiveSkill: 'standard_application', taskFamily: 'elementary_function_exp_log_ordering',
      planTemplate: 'math_medium_exp_log_ordering_chain_v1', expectedNegativeCode: 'candidate_plan_math_exp_log_ordering_chain_missing',
      requiredGuidancePhrase: 'Select exactly one exp/log ordering archetype',
      positiveCandidate: {
        prompt: '设 a=2^{1/3}，b=4^{1/4}，c=8^{1/5}，下列大小关系正确的是（ ）',
        options: [{ id: 'A', text: 'a<b<c' }, { id: 'B', text: 'a<c<b' }, { id: 'C', text: 'b<a<c' }, { id: 'D', text: 'c<b<a' }],
        explanation: '化为同底数：a=2^{1/3}，b=2^{1/2}，c=2^{3/5}。因为 1/3<1/2<3/5，且指数函数 2^x 递增，所以 a<b<c，故选 A。'
      },
      negativeCandidate: {
        prompt: '求 log_2 8 的值。',
        options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }],
        explanation: '因为 2^3=8，所以答案为 3。'
      }
    },
    {
      subject: 'math', cellId: 355, topicId: 35, topicCode: 'M-EF-001', topicModule: 'Functions', topicTitle: '基本初等函数（指数、对数、幂函数）', difficulty: 'basic',
      examScope: 'Evaluate one elementary function value or identify one direct property.', gapKey: 'math-elementary-function-basic',
      questionForm: 'calculation', cognitiveSkill: 'direct_application', taskFamily: 'elementary_function_direct_property',
      planTemplate: 'math_elementary_function_relation_v1', expectedNegativeCode: 'candidate_plan_math_basic_elementary_function_multiple_objects_forbidden',
      requiredGuidancePhrase: 'state exactly one concrete function',
      positiveCandidate: {
        prompt: '已知对数函数 f(x)=log_2 x，函数值 f(8) 等于（ ）',
        options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }, { id: 'C', text: '4' }, { id: 'D', text: '8' }],
        explanation: '由对数的定义，因为 2^3=8，所以 f(8)=log_2 8=3，故选 B。'
      },
      negativeCandidate: {
        prompt: '设 a=log_2 5，b=2^{3/5}，c=\sqrt[3]{5}，下列大小排序正确的是（ ）',
        options: [{ id: 'A', text: 'a>b>c' }, { id: 'B', text: 'b>c>a' }],
        explanation: '分别比较三个表达式的区间和大小，可得 a>b>c。'
      },
      historicalLiveNegativeCode: 'candidate_plan_math_basic_elementary_function_property_stack_forbidden',
      historicalLiveNegativeCandidate: {
        prompt: '已知函数 f(x)=log_{1/2}x 的定义域为 (0,+∞)，下列关于其单调性的判断正确的是（ ）',
        options: [{ id: 'A', text: '在定义域上单调递减' }, { id: 'B', text: '在定义域上单调递增' }, { id: 'C', text: '不是单调函数' }, { id: 'D', text: '无法判断' }],
        explanation: '因为底数 1/2 介于 0 与 1 之间，所以对数函数在定义域上单调递减，故选 A。'
      },
      additionalClassificationCandidate: {
        prompt: '已知根式函数 f(x)=√(x-2)，其定义域为（ ）',
        options: [{ id: 'A', text: '[2,+∞)' }, { id: 'B', text: '(2,+∞)' }, { id: 'C', text: '(-∞,2]' }, { id: 'D', text: 'R' }],
        explanation: '由 x-2≥0 得 x≥2，因此定义域为 [2,+∞)，故选 A。'
      }
    }
  ];
  const samples = fixtures.map(evaluateFixture);
  const report = {
    mode: 'current_open_cell_question_plan_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    studentConsumableImpact: 'none_no_publish',
    sampleCount: samples.length,
    samples
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(`Current open-cell QuestionPlan self-test: ${report.status}, samples=${report.sampleCount}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
