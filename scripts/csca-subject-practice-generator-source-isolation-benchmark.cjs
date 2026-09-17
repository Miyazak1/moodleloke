#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const { QuestionPromptBuilderService } = require('../backend/src/ai-questioning/question-prompt-builder.service');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_FORBIDDEN_SOURCE_FIELDS,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} = require('../backend/src/ai-questioning/subject-practice-generator-source-isolation-policy');

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

const cases = [
  {
    subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicTitle: '基本初等函数',
    productionCellId: 16, difficulty: 'basic', taskFamily: 'elementary_function_direct_property',
    requiredElementaryFunctionClass: 'logarithmic', requiredSinglePropertyTarget: 'domain',
    examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。', skill: 'concept_identification'
  },
  {
    subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicTitle: 'Kinematics',
    productionCellId: 24, difficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
    examScope: '直线运动中位移、时间、速度和加速度的基本关系。', skill: 'direct_application'
  },
  {
    subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicTitle: '溶液浓度与pH计算',
    productionCellId: 41, difficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。', skill: 'standard_application'
  }
];

const builder = new QuestionPromptBuilderService();
const results = cases.map((item) => {
  const sentinel = `SOURCE_LEAK_SENTINEL_${item.subject} original prompt and answer D must remain unseen`;
  const plan = buildSubjectPracticeQuestionPlan({
    subject: item.subject,
    topicId: item.topicId,
    topicTitle: item.topicTitle,
    productionCellId: item.productionCellId,
    targetDifficulty: item.difficulty,
    taskFamily: item.taskFamily,
    requiredElementaryFunctionClass: item.requiredElementaryFunctionClass,
    requiredSinglePropertyTarget: item.requiredSinglePropertyTarget
  });
  const poisonedPlan = {
    ...plan,
    rawSourceQuestion: { prompt: sentinel, correctAnswer: 'D', explanation: sentinel },
    reasoningSteps: [...plan.reasoningSteps, { id: 'source_poison', operation: sentinel, inputs: [], output: 'answer' }]
  };
  const built = builder.build({
    id: item.productionCellId,
    subject: item.subject,
    topicId: item.topicId,
    topicCode: item.topicCode,
    topicModule: item.subject,
    topicTitle: item.topicTitle,
    syllabusVersion: '2025',
    examScope: item.examScope,
    allowedQuestionTypes: ['single_choice'],
    difficultyRange: [item.difficulty],
    excludedScope: [],
    sourceLabel: sentinel,
    sourceUrl: `https://example.invalid/${encodeURIComponent(sentinel)}`,
    difficulty: item.difficulty,
    questionType: 'single_choice',
    skill: item.skill,
    constraints: {
      intendedUse: 'subject_practice',
      rawSourceQuestion: { prompt: sentinel, options: [sentinel], correctAnswer: 'D', explanation: sentinel },
      arbitraryNotes: sentinel,
      mockExamSlot: { slotId: 801, slotNumber: 2, blueprintId: 802, sourcePaperId: 803 },
      targetProfile: {
        gapKey: `${item.subject}_source_isolation`,
        questionForm: 'calculation_application', cognitiveSkill: 'standard_application',
        difficultyBand: item.difficulty, readingLoad: 'medium', calculationLoad: 'medium',
        sourcePrompt: sentinel,
        distractorTypes: ['calculation_error', sentinel],
        commonMisconceptions: ['sign_error', sentinel],
        generationStrategy: {
          requiredStemPattern: 'direct_relation',
          requiredStemPatternInstruction: sentinel,
          promptChecklist: [sentinel],
          diversityAxes: ['numeric_parameters', sentinel]
        }
      },
      styleProfile: {
        id: `${item.subject}_style_v1`, profileVersion: 'v1', confidence: 'high', sampleSize: 20,
        profile: {
          generationGuidelines: [sentinel], reviewerGuidelines: [sentinel],
          commonQuestionForms: ['calculation_application'], commonCognitiveSkills: ['standard_application'],
          optionPatterns: { answerShape: 'short_claim', rawExample: sentinel },
          stemPatterns: { conditionBand: 'compact', rawExample: sentinel },
          similarityRiskSignals: [sentinel]
        }
      },
      expansion: {
        generationMode: 'subject_practice_production_matrix',
        batchId: sentinel,
        previousQuestionId: 804,
        questionPlan: poisonedPlan
      }
    }
  });
  const providerText = built.messages.map((message) => message.content).join('\n');
  const providerProjectionSha256 = crypto.createHash('sha256')
    .update(JSON.stringify(canonicalJsonValue(built.messages)))
    .digest('hex');
  const payload = JSON.parse(built.messages[1].content);
  const metadataText = JSON.stringify(built.metadata);
  const sourceIsolation = built.metadata.promptAudit.sourceIsolation;
  const checks = {
    providerMessageExcludesSentinel: !providerText.includes(sentinel),
    metadataRetainsSentinel: metadataText.includes(sentinel),
    sourceIdentityOmitted: payload.syllabusScope.sourceLabel === undefined && payload.syllabusScope.sourceUrl === undefined,
    arbitraryConstraintsOmitted: payload.constraints.rawSourceQuestion === undefined && payload.constraints.arbitraryNotes === undefined,
    sourceLinkageIdentifiersOmitted: payload.constraints.mockExamSlot?.slotNumber === 2
      && payload.constraints.mockExamSlot?.slotId === undefined
      && payload.constraints.mockExamSlot?.blueprintId === undefined
      && payload.constraints.mockExamSlot?.sourcePaperId === undefined
      && payload.expansion.batchId === undefined
      && payload.expansion.previousQuestionId === undefined,
    targetProfileFreeTextOmitted: payload.targetProfile.sourcePrompt === undefined
      && payload.targetProfile.generationStrategy === undefined
      && !JSON.stringify(payload.targetProfile).includes(sentinel),
    styleFreeTextOmitted: payload.styleReference === null
      ? built.metadata.promptAudit.sourceIsolation.providerStyleReferenceMode === 'absent'
      : payload.styleReference.policy === 'structural_profile_only_source_unseen'
        && payload.styleReference.generationGuidelines === undefined
        && payload.styleReference.reviewerGuidelines === undefined
        && !JSON.stringify(payload.styleReference).includes(sentinel),
    canonicalPlanRebuilt: payload.expansion.questionPlan.rawSourceQuestion === undefined
      && !JSON.stringify(payload.expansion.questionPlan).includes('source_poison')
      && payload.expansion.questionPlan.planTemplate === plan.planTemplate,
    auditEnforced: sourceIsolation.policyVersion === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION
      && sourceIsolation.status === 'enforced_structural_projection',
    generatorInvocationBoundaryExplicit: sourceIsolation.boundary === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY
      && sourceIsolation.allowedInput === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
    originalAndReversibleSourceFieldsForbidden: sourceIsolation.originalQuestionContentOmitted === true
      && sourceIsolation.reversibleSourceFieldsOmitted === true
      && JSON.stringify(sourceIsolation.forbiddenSourceFields)
        === JSON.stringify([...SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_FORBIDDEN_SOURCE_FIELDS]),
    developerUnseenNotRequired: sourceIsolation.developerUnseenRequired === false
      && sourceIsolation.officialHoldoutRequiredForGeneratorIsolation === false,
    providerProjectionDigestBound: sourceIsolation.providerProjectionSha256 === providerProjectionSha256
      && JSON.stringify(sourceIsolation.providerProjection) === JSON.stringify(built.messages),
    aggregationPolicyEnforced: sourceIsolation.sourceLinkageIdentifiersOmitted === true
      && sourceIsolation.profileAggregationPolicyVersion === SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION
      && sourceIsolation.profileMinimumSampleSize === SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
      && sourceIsolation.profileProjectionMode === SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
      && sourceIsolation.providerProjectionReplayable === true
  };
  return {
    subject: item.subject,
    sentinelSha256: crypto.createHash('sha256').update(sentinel).digest('hex'),
    providerMessageSha256: crypto.createHash('sha256').update(providerText).digest('hex'),
    checks,
    passed: Object.values(checks).every(Boolean)
  };
});

const lowSampleBuilt = builder.build({
  id: 991,
  subject: 'math',
  topicId: 69,
  topicCode: 'M-FUN-002',
  topicModule: 'math',
  topicTitle: '基本初等函数',
  syllabusVersion: '2025',
  examScope: '基本初等函数的定义域和值域。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: [],
  sourceLabel: null,
  sourceUrl: null,
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'concept_identification',
  constraints: {
    intendedUse: 'subject_practice',
    styleProfile: {
      id: 'single_source_profile',
      sampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE - 1,
      profile: { commonQuestionForms: ['concept_check'] }
    }
  }
});
const lowSamplePayload = JSON.parse(lowSampleBuilt.messages[1].content);
const lowSampleProfileOmitted = lowSamplePayload.styleReference === null
  && lowSampleBuilt.metadata.promptAudit.sourceIsolation.lowSampleStyleProfileOmitted === true
  && lowSampleBuilt.metadata.promptAudit.sourceIsolation.providerStyleReferenceMode
    === 'omitted_below_minimum_aggregate_sample_size';
let knownSourceSmuggleRejected = false;
const smuggledSourceText = '这是一段用于验证来源隔离的独特原题题干连续文本不得进入生成器输入';
try {
  builder.build({
    id: 992,
    subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: 'math', topicTitle: '基本初等函数',
    syllabusVersion: '2025', examScope: smuggledSourceText,
    allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: [], sourceLabel: null, sourceUrl: null,
    difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification',
    constraints: { intendedUse: 'subject_practice', rawSourceQuestion: { prompt: smuggledSourceText } }
  });
} catch (error) {
  knownSourceSmuggleRejected = String(error?.message).includes('known_source_fragment_detected');
}

const report = {
  mode: 'subject_practice_generator_source_isolation_benchmark',
  reportVersion: 'subject-practice-generator-source-isolation-benchmark-v3',
  policyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  status: results.every((item) => item.passed) && lowSampleProfileOmitted && knownSourceSmuggleRejected ? 'passed' : 'failed',
  subjectCount: results.length,
  passedSubjectCount: results.filter((item) => item.passed).length,
  providerLeakCount: results.filter((item) => !item.checks.providerMessageExcludesSentinel).length,
  metadataRetentionCount: results.filter((item) => item.checks.metadataRetainsSentinel).length,
  lowSampleProfileOmitted,
  knownSourceSmuggleRejected,
  providerImpact: 'none_no_provider_call',
  providerCallCount: 0,
  estimatedCostUsd: 0,
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_shadow',
  results
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed' || !report.lowSampleProfileOmitted) process.exitCode = 1;
}

module.exports = { report };
