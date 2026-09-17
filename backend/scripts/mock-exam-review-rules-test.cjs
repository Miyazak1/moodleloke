require('ts-node/register/transpile-only');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { QuestionReviewerService } = require('../src/ai-questioning/question-reviewer.service');
const { QuestionValidatorService } = require('../src/ai-questioning/question-validator.service');
const { QuestionPromptBuilderService } = require('../src/ai-questioning/question-prompt-builder.service');
const { parseProviderReview } = require('../src/ai-questioning/question-reviewer-provider.service');
const { mockExamRepairStrategy, mockExamRepairFeedback, mockExamRegenerationFeedback, mockExamReplannedTargetProfile } = require('../src/csca-mock-exam/csca-mock-exam.service');

const provider = {
  async review() {
    return {
      issues: [],
      dimensions: [],
      provider: { provider: 'rule-test', model: 'rule-test', status: 'success' }
    };
  },
  agentIdentity(nextProvider) {
    return {
      role: 'reviewer',
      name: 'rule-test-reviewer',
      provider: nextProvider?.provider ?? 'rule-test',
      model: nextProvider?.model ?? 'rule-test',
      promptVersion: 'rule-test'
    };
  }
};

const reviewer = new QuestionReviewerService(new QuestionValidatorService(), provider);

function baseCandidate(overrides = {}) {
  return {
    subject: 'math',
    topicId: 1,
    blueprintId: 100,
    sourceType: 'ai',
    designedDifficulty: 'medium',
    questionType: 'single_choice',
    prompt: '已知关于 x 的不等式 ax^2 + bx + c > 0 的解集为 (1,2)，求关于 x 的不等式 cx^2 + bx + a > 0 的解集。',
    options: [
      { id: 'A', text: '(-∞, 1/2) ∪ (1, +∞)' },
      { id: 'B', text: '(1/2, 1)' },
      { id: 'C', text: '(-∞, 1) ∪ (2, +∞)' },
      { id: 'D', text: '(1, 2)' }
    ],
    correctAnswer: 'A',
    explanation: '答案为 A。由原不等式根为 1 和 2 可得系数关系，代入新不等式后得到选项 A 的区间。',
    knowledgeTags: ['不等式', '二次不等式'],
    optionMetadata: [
      { optionId: 'B', distractorIntent: '忽略系数互换', misconceptionTags: ['系数关系误用'] },
      { optionId: 'C', distractorIntent: '沿用原解集方向', misconceptionTags: ['解集迁移错误'] },
      { optionId: 'D', distractorIntent: '误保留原区间', misconceptionTags: ['原区间误用'] }
    ],
    syllabusVersion: '2025',
    ...overrides
  };
}

async function main() {
  const mockExamServiceSource = fs.readFileSync(path.join(__dirname, '../src/csca-mock-exam/csca-mock-exam.service.ts'), 'utf8');
  assert(
    mockExamServiceSource.includes("process.env.CSCA_MOCK_EXAM_GENERATION_RECOVERY_AUTO_RESUME !== 'false'"),
    'Mock exam generation recovery must auto-resume by default so interrupted 48-slot jobs continue closing the loop.'
  );

  const parsedHighRubricWithZeroScore = parseProviderReview(JSON.stringify({
    decision: 'approve',
    score: 0,
    rubric: {
      syllabusAlignment: 100,
      answerCorrectness: 100,
      optionQuality: 100,
      explanationQuality: 100,
      difficultyMatch: 100,
      languageQuality: 95,
      styleAlignment: 95,
      examLikeDifficulty: 100,
      pastPaperSimilarityRisk: 0
    },
    issues: [],
    dimensions: [
      { key: 'syllabus_alignment', status: 'passed', note: 'ok' },
      { key: 'single_correct_answer', status: 'passed', note: 'ok' },
      { key: 'option_mutual_exclusion', status: 'passed', note: 'ok' },
      { key: 'explanation_supports_answer', status: 'passed', note: 'ok' },
      { key: 'difficulty_match', status: 'passed', note: 'ok' },
      { key: 'prompt_leakage', status: 'passed', note: 'ok' },
      { key: 'duplicate_risk', status: 'passed', note: 'ok' },
      { key: 'distractor_quality', status: 'passed', note: 'ok' },
      { key: 'domain_sanity', status: 'passed', note: 'ok' }
    ]
  }));
  assert(parsedHighRubricWithZeroScore);
  assert(parsedHighRubricWithZeroScore.score >= 90);

  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['review_error_issue'],
    reviewIssueCodes: ['equivalent_option_text']
  }), 'repair_in_place');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['missing_bilingual_localization'],
    reviewIssueCodes: []
  }), 'repair_in_place');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['review_failed_dimension'],
    reviewIssueCodes: ['explanation_answer_conflict']
  }), 'repair_in_place');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['profile_alignment_failed'],
    reviewIssueCodes: ['difficulty_band_mismatch']
  }), 'hard_regenerate');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['past_paper_similarity_medium'],
    reviewIssueCodes: []
  }), 'hard_regenerate');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['review_error_issue'],
    reviewIssueCodes: ['topic_mismatch']
  }), 'hard_regenerate');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'human_review',
    gateReasons: ['profile_alignment_warning'],
    reviewIssueCodes: ['question_form_mismatch']
  }), 'hard_regenerate');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'human_review',
    gateReasons: ['profile_alignment_warning'],
    reviewIssueCodes: ['cognitive_skill_mismatch']
  }), 'hard_regenerate');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'human_review',
    gateReasons: ['review_warning_issue'],
    reviewIssueCodes: ['reading_load_mismatch']
  }), 'repair_in_place');
  assert.equal(mockExamRepairStrategy({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['review_failed_dimension'],
    reviewIssueCodes: ['cross_subject_context']
  }), 'hard_regenerate');
  const repairFeedback = mockExamRepairFeedback({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'regenerate',
    gateReasons: ['missing_bilingual_localization'],
    reviewIssueCodes: ['equivalent_option_text', 'explanation_answer_conflict'],
    targetProfile: { difficultyBand: 'medium' },
    previousQuestionId: 1,
    repairAttempt: 1,
    slotNumber: 1
  });
  assert.equal(repairFeedback.strategy, 'revise_candidate_then_rereview');
  assert(repairFeedback.targetedInstructions.some((item) => item.includes('Repair answer and option logic')));
  assert(repairFeedback.targetedInstructions.some((item) => item.includes('Repair explanation consistency')));
  assert(repairFeedback.targetedInstructions.some((item) => item.includes('Repair localization')));
  const retryFeedback = mockExamRegenerationFeedback({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'human_review',
    gateReasons: ['profile_alignment_warning'],
    reviewIssueCodes: ['question_form_mismatch', 'equivalent_option_text', 'cognitive_skill_mismatch'],
    targetProfile: {
      module: '集合与不等式',
      questionForm: 'calculation_application',
      cognitiveSkill: 'concept_discrimination',
      calculationLoad: 'none',
      difficultyBand: 'hard',
      readingLoad: 'medium'
    },
    previousQuestionId: 9,
    generationAttempt: 2,
    slotNumber: 7
  });
  assert.equal(retryFeedback.repairMode, 'regenerate_variant_after_gate_failure');
  assert.equal(retryFeedback.targetProfile.questionForm, 'concept_judgement');
  assert.equal(retryFeedback.targetProfile.cognitiveSkill, 'concept_discrimination');
  assert.equal(retryFeedback.targetProfile.generationStrategy.topicFamily, 'inequality');
  assert(retryFeedback.targetProfile.generationStrategy.bannedStemPatterns.includes('direct_solve_inequality'));
  assert(retryFeedback.targetedInstructions.some((item) => item.includes('requiredStemPattern=')));
  assert(retryFeedback.blockedPatterns.some((item) => item.includes('surface question form')));
  assert(retryFeedback.blockedPatterns.some((item) => item.includes('equivalent')));
  assert(retryFeedback.instruction.includes('fresh replacement candidate'));
  const nextRetryFeedback = mockExamRegenerationFeedback({
    issue: 'review_gate_not_passed:regenerate',
    gateDecision: 'human_review',
    gateReasons: ['profile_alignment_warning'],
    reviewIssueCodes: ['question_form_mismatch', 'cognitive_skill_mismatch'],
    targetProfile: retryFeedback.targetProfile,
    previousQuestionId: 10,
    generationAttempt: 3,
    slotNumber: 7
  });
  assert.notEqual(
    nextRetryFeedback.targetProfile.generationStrategy.requiredStemPattern,
    retryFeedback.targetProfile.generationStrategy.requiredStemPattern
  );
  const replannedTargetProfile = mockExamReplannedTargetProfile({
    targetProfile: retryFeedback.targetProfile,
    issue: 'review_gate_not_passed:human_review',
    gateReasons: ['profile_alignment_failed'],
    reviewIssueCodes: ['question_form_mismatch', 'cognitive_skill_mismatch'],
    slotNumber: 7,
    replanAttempt: 1
  });
  assert.equal(replannedTargetProfile.generationStrategy.source, 'closed_loop_replan');
  assert.equal(replannedTargetProfile.closedLoop.status, 'replanned');
  assert.equal(replannedTargetProfile.closedLoop.replanAttempt, 1);
  assert(replannedTargetProfile.generationStrategy.bannedStemPatterns.includes(retryFeedback.targetProfile.generationStrategy.requiredStemPattern));
  assert.notEqual(
    replannedTargetProfile.generationStrategy.requiredStemPattern,
    retryFeedback.targetProfile.generationStrategy.requiredStemPattern
  );
  const secondReplan = mockExamReplannedTargetProfile({
    targetProfile: replannedTargetProfile,
    issue: 'review_gate_not_passed:human_review',
    gateReasons: ['profile_alignment_failed'],
    reviewIssueCodes: ['question_form_mismatch'],
    slotNumber: 7,
    replanAttempt: 2
  });
  assert.equal(secondReplan.generationStrategy.source, 'closed_loop_replan');
  assert.equal(secondReplan.closedLoop.replanAttempt, 2);
  assert(secondReplan.generationStrategy.requiredStemPattern);
  assert(!secondReplan.generationStrategy.bannedStemPatterns.includes(secondReplan.generationStrategy.requiredStemPattern));

  const promptBuilder = new QuestionPromptBuilderService();
  const retryPrompt = promptBuilder.build({
    id: 100,
    subject: 'math',
    topicId: 1,
    topicCode: 'M-INEQ-001',
    topicModule: 'algebra',
    topicTitle: '不等式的基本性质与解法',
    syllabusVersion: '2025',
    examScope: '不等式变形、区间解集与条件判断',
    allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['medium', 'hard'],
    excludedScope: [],
    sourceLabel: 'rule-test',
    sourceUrl: null,
    difficulty: 'medium',
    questionType: 'single_choice',
    skill: 'standard_application',
    constraints: {
      generationSource: 'mock_exam_blueprint_slot',
      generationMode: 'online_mock_exam_candidate',
      mockExamSlot: { slotNumber: 7, questionCount: 48 },
      targetProfile: retryFeedback.targetProfile,
      expansion: {
        generationMode: 'online_mock_exam_candidate',
        repairFeedback: retryFeedback
      }
    }
  });
  const retrySystemPrompt = retryPrompt.messages[0].content;
  assert(retrySystemPrompt.includes('targetProfile is a hard contract'));
  assert(retrySystemPrompt.includes('requiredStemPattern='));
  assert(retrySystemPrompt.includes('direct_solve_inequality'));
  assert(retrySystemPrompt.includes('hard negative feedback'));
  assert(retrySystemPrompt.includes('fresh replacement candidate'));
  const retryUserPayload = JSON.parse(retryPrompt.messages[1].content);
  assert.equal(retryUserPayload.expansion.repairFeedback.repairMode, 'regenerate_variant_after_gate_failure');
  assert(retryUserPayload.expansion.repairFeedback.blockedPatterns.some((item) => item.includes('surface question form')));
  assert(retryUserPayload.expansion.repairFeedback.blockedPatterns.some((item) => item.includes('equivalent')));
  assert.equal(retryUserPayload.targetProfile.questionForm, 'concept_judgement');
  assert.equal(retryUserPayload.targetProfile.generationStrategy.topicFamily, 'inequality');

  const minorAlignment = await reviewer.review(baseCandidate(), {
    subject: 'math',
    topicId: 1,
    topicTitle: '不等式的基本性质与解法',
    syllabusVersion: '2025',
    targetProfile: {
      questionForm: 'calculation_application',
      cognitiveSkill: 'multi_step_reasoning',
      readingLoad: 'medium',
      calculationLoad: 'medium',
      difficultyBand: 'medium'
    },
    styleProfile: { confidence: 'high' }
  });
  assert.equal(minorAlignment.profileAlignment.status, 'warning');
  assert.deepEqual(minorAlignment.profileAlignment.reasons, ['calculation_load_band_mismatch']);
  assert.equal(minorAlignment.issues.some((issue) => issue.code === 'profile_alignment_warning'), false);
  assert.equal(minorAlignment.status, 'passed');

  const hardMismatch = await reviewer.review(baseCandidate({
    prompt: '解不等式 3 - 2x > 5，其解集为（ ）',
    options: [
      { id: 'A', text: 'x < -1' },
      { id: 'B', text: 'x > -1' },
      { id: 'C', text: 'x < 1' },
      { id: 'D', text: 'x > 1' }
    ],
    correctAnswer: 'A',
    explanation: '答案为 A。移项得 -2x > 2，两边除以 -2 不等号反向，所以 x < -1。'
  }), {
    subject: 'math',
    topicId: 1,
    topicTitle: '不等式的基本性质与解法',
    syllabusVersion: '2025',
    targetProfile: {
      questionForm: 'concept_check',
      cognitiveSkill: 'standard_application',
      readingLoad: 'medium',
      calculationLoad: 'light',
      difficultyBand: 'basic'
    },
    styleProfile: { confidence: 'high' }
  });
  assert.equal(hardMismatch.issues.some((issue) => issue.code === 'profile_alignment_warning'), true);
  assert.equal(hardMismatch.profileAlignment.reasons.includes('difficulty_band_mismatch'), true);
  assert.equal(hardMismatch.status, 'needs_review');

  const equivalentOptions = await reviewer.review(baseCandidate({
    options: [
      { id: 'A', text: 'x > 1' },
      { id: 'B', text: 'x>1' },
      { id: 'C', text: 'x < 1' },
      { id: 'D', text: 'x = 1' }
    ],
    correctAnswer: 'A',
    explanation: '答案为 A。化简不等式后得到 x > 1。'
  }), {
    subject: 'math',
    topicId: 1,
    topicTitle: '不等式的基本性质与解法',
    syllabusVersion: '2025',
    targetProfile: {
      questionForm: 'calculation_application',
      cognitiveSkill: 'standard_application',
      readingLoad: 'low',
      calculationLoad: 'light',
      difficultyBand: 'basic'
    },
    styleProfile: { confidence: 'high' }
  });
  assert.equal(equivalentOptions.issues.some((issue) => issue.code === 'equivalent_option_text'), true);
  assert.equal(equivalentOptions.status, 'failed');

  console.log('mock-exam-review-rules-test: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
