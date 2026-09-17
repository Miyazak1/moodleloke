import type {
  AdminAIQuestioningQuestion,
  AdminAIQuestioningSourceQuestion
} from '../../../lib/api-types';
import { metadataText } from './questionFormatting';
import { questionOptionsFromUnknown, recordFrom } from './questionData';

export function candidateUsesFallback(question: AdminAIQuestioningQuestion) {
  const metadata = recordFrom(question.generationMetadata);
  return metadata.fallbackUsed === true ||
    metadata.generator === 'rule-fallback' ||
    metadata.status === 'generator_disabled';
}

export function isMockExamCandidate(question: Pick<AdminAIQuestioningQuestion, 'generationMetadata'> & { sourceKind?: string }) {
  const metadata = recordFrom(question.generationMetadata);
  const sourceKind = metadataText(question.sourceKind ?? metadata.sourceKind ?? metadata.generationSource, '');
  return sourceKind === 'mock_exam_blueprint_slot' ||
    metadataText(metadata.generationMode, '') === 'online_mock_exam_candidate' ||
    Boolean(recordFrom(metadata.mockExamSlot).slotId);
}

export function mockExamAssemblyEvidence(question: Pick<AdminAIQuestioningQuestion, 'reviewMetadata'>) {
  const approval = recordFrom(recordFrom(question.reviewMetadata).mockExamApproval);
  const targetPaperId = typeof approval.targetPaperId === 'number' ? approval.targetPaperId : Number(approval.targetPaperId);
  const assembledQuestionId = typeof approval.assembledQuestionId === 'number' ? approval.assembledQuestionId : Number(approval.assembledQuestionId);
  const assembledOrderNumber = typeof approval.assembledOrderNumber === 'number' ? approval.assembledOrderNumber : Number(approval.assembledOrderNumber);
  return {
    status: metadataText(approval.status, ''),
    targetPaperId: Number.isFinite(targetPaperId) && targetPaperId > 0 ? targetPaperId : null,
    targetPaperTitle: metadataText(approval.targetPaperTitle, ''),
    assembledQuestionId: Number.isFinite(assembledQuestionId) && assembledQuestionId > 0 ? assembledQuestionId : null,
    assembledOrderNumber: Number.isFinite(assembledOrderNumber) && assembledOrderNumber > 0 ? assembledOrderNumber : null,
    assembledAt: metadataText(approval.assembledAt, ''),
    assembled: metadataText(approval.status, '') === 'assembled_in_mock_exam_draft'
  };
}

function candidateHasSmokeSignal(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const scope = recordFrom(generation.syllabusScope);
  const values = [
    question.syllabusVersion,
    generation.syllabusVersion,
    generation.sourceKind,
    generation.generationSource,
    generation.generationMode,
    scope.syllabusVersion,
    scope.topicCode,
    scope.topicTitle,
    scope.topicModule,
    scope.examScope
  ];
  return values.some((value) => metadataText(value, '').toLowerCase().includes('smoke'));
}

function candidatePromptText(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const localizations = recordFrom(generation.localizations);
  const zh = recordFrom(localizations.zh);
  const en = recordFrom(localizations.en);
  return metadataText(question.prompt, '') || metadataText(zh.prompt, '') || metadataText(en.prompt, '');
}

function candidateLooksTrivialArithmetic(question: AdminAIQuestioningQuestion) {
  const prompt = candidatePromptText(question);
  if (!prompt || prompt.length > 80) return false;
  const asksForValue = /(表达式|计算|求|值|多少|calculate|value|evaluate)/i.test(prompt);
  const hasArithmeticExpression = /\d+\s*(?:[+＋\-−*×xX÷/])\s*\d+(?:\s*(?:[+＋\-−*×xX÷/])\s*\d+)?/.test(prompt);
  const hasAdvancedSignal = /(函数|方程|不等式|概率|统计|几何|向量|导数|积分|矩阵|证明|推理|建模|参数|集合|实数|分布|function|equation|probability|geometry|vector|derivative|integral|matrix|model)/i.test(prompt);
  return asksForValue && hasArithmeticExpression && !hasAdvancedSignal;
}

function candidateDerivedGateReasons(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const review = recordFrom(question.reviewMetadata);
  const styleProfile = candidateStyleProfileEvidence(question);
  const sourceKind = metadataText(generation.sourceKind ?? generation.generationSource, '');
  const intendedUse = metadataText(generation.intendedUse, '');
  const issues = Array.isArray(review.issues) ? review.issues.map(recordFrom) : [];
  const dimensions = Array.isArray(review.dimensions) ? review.dimensions.map(recordFrom) : [];
  const profileAlignment = recordFrom(review.profileAlignment);
  const hard: string[] = [];
  const human: string[] = [];
  if (candidateHasSmokeSignal(question)) hard.push('smoke_candidate');
  if (candidateLooksTrivialArithmetic(question)) hard.push('trivial_arithmetic_candidate');
  if (isMockExamCandidate(question)) {
    for (const issue of issues) {
      if (metadataText(issue.severity, '') !== 'warning') continue;
      const code = metadataText(issue.code, '').toLowerCase();
      const message = metadataText(issue.message, '').toLowerCase();
      if (code === 'weak_syllabus_signal') human.push('weak_syllabus_signal');
      if (code === 'profile_alignment_warning') human.push('profile_alignment_warning');
      if (/human confirmation|human review|人工确认|人工审核|需要人工/.test(message)) {
        human.push(code === 'weak_syllabus_signal' ? 'weak_syllabus_signal' : code === 'profile_alignment_warning' ? 'profile_alignment_warning' : 'reviewer_quality_attention');
      }
    }
    for (const dimension of dimensions) {
      if (metadataText(dimension.status, '') !== 'warning') continue;
      if (/human confirmation|human review|人工确认|人工审核|需要人工/.test(metadataText(dimension.note, '').toLowerCase())) {
        human.push('reviewer_quality_attention');
      }
    }
    if (metadataText(profileAlignment.status, '') === 'warning') human.push('profile_alignment_warning');
  }
  if (intendedUse === 'subject_practice' && sourceKind === 'syllabus' && !styleProfile.used) {
    human.push('style_profile_absent_for_subject_practice');
  }
  return { hard: Array.from(new Set(hard)), human: Array.from(new Set(human)) };
}

export function candidateStyleProfileEvidence(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const profile = recordFrom(generation.styleProfile);
  const freshness = recordFrom(profile.freshness);
  const sourceSimilarity = recordFrom(generation.sourceSimilarity);
  const sourceMatches = Array.isArray(sourceSimilarity.matches) ? sourceSimilarity.matches.map(recordFrom) : [];
  const profileId = typeof profile.id === 'number' ? profile.id : Number(profile.id);
  const sampleSize = typeof profile.sampleSize === 'number' ? profile.sampleSize : Number(profile.sampleSize);
  const currentApprovedSampleCount = typeof freshness.currentApprovedSampleCount === 'number' ? freshness.currentApprovedSampleCount : Number(freshness.currentApprovedSampleCount);
  const missingApprovedSampleCount = typeof freshness.missingApprovedSampleCount === 'number' ? freshness.missingApprovedSampleCount : Number(freshness.missingApprovedSampleCount);
  return {
    sourceKind: metadataText(generation.sourceKind ?? generation.generationSource, 'syllabus'),
    profileId: Number.isFinite(profileId) && profileId > 0 ? profileId : null,
    confidence: metadataText(profile.confidence, ''),
    sampleSize: Number.isFinite(sampleSize) && sampleSize >= 0 ? sampleSize : null,
    scopeType: metadataText(profile.scopeType, ''),
    freshness: {
      stale: freshness.stale === true,
      currentApprovedSampleCount: Number.isFinite(currentApprovedSampleCount) ? currentApprovedSampleCount : null,
      missingApprovedSampleCount: Number.isFinite(missingApprovedSampleCount) ? missingApprovedSampleCount : null,
      checkedAt: metadataText(freshness.checkedAt, '')
    },
    maxSimilarity: typeof sourceSimilarity.maxSimilarity === 'number' ? sourceSimilarity.maxSimilarity : null,
    matches: sourceMatches
      .map((match) => {
        const sourceQuestionId = typeof match.sourceQuestionId === 'number' ? match.sourceQuestionId : Number(match.sourceQuestionId);
        const similarity = typeof match.similarity === 'number' ? match.similarity : Number(match.similarity);
        return {
          sourceQuestionId: Number.isFinite(sourceQuestionId) && sourceQuestionId > 0 ? sourceQuestionId : null,
          questionNumber: metadataText(match.questionNumber, '-'),
          similarity: Number.isFinite(similarity) ? similarity : null
        };
      })
      .filter((match) => match.sourceQuestionId !== null || match.similarity !== null),
    used: Number.isFinite(profileId) && profileId > 0
  };
}

export type SourceTopicSuggestion = {
  topicCode: string;
  topicId: number | null;
  topicTitle: string;
  module: string;
  confidence: number;
  reason: string;
};

export function sourceTopicMappingEvidence(question: AdminAIQuestioningSourceQuestion) {
  const mapping = recordFrom(recordFrom(question.analysis).aiTopicMapping);
  const suggestions = Array.isArray(mapping.suggestions)
    ? mapping.suggestions
      .map(recordFrom)
      .map((suggestion): SourceTopicSuggestion => ({
        topicCode: metadataText(suggestion.topicCode, ''),
        topicId: typeof suggestion.topicId === 'number' ? suggestion.topicId : null,
        topicTitle: metadataText(suggestion.topicTitle, ''),
        module: metadataText(suggestion.module, ''),
        confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : Number(suggestion.confidence ?? 0),
        reason: metadataText(suggestion.reason, '')
      }))
      .filter((suggestion) => suggestion.topicCode && Number.isFinite(suggestion.confidence))
      .sort((left, right) => right.confidence - left.confidence)
    : [];
  return {
    status: metadataText(mapping.status, ''),
    error: metadataText(mapping.error, ''),
    generatedAt: metadataText(mapping.generatedAt, ''),
    topConfidence: suggestions[0]?.confidence ?? 0,
    suggestions
  };
}

export function candidateAgentEvidence(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const generatorAgent = recordFrom(generation.agent);
  const review = recordFrom(question.reviewMetadata);
  const reviewerAgent = recordFrom(review.agent);
  const generationRun = recordFrom(generation.agentRun);
  const reviewRun = recordFrom(review.agentRun);
  const gate = recordFrom(review.gate);
  const rubric = recordFrom(review.rubric);
  const profileAlignment = recordFrom(review.profileAlignment);
  const alignmentEvidence = recordFrom(profileAlignment.evidence);
  const alignmentScore = typeof profileAlignment.score === 'number' ? profileAlignment.score : Number(profileAlignment.score);
  const issues = Array.isArray(review.issues) ? review.issues.map(recordFrom) : [];
  const dimensions = Array.isArray(review.dimensions) ? review.dimensions.map(recordFrom) : [];
  const derivedGate = candidateDerivedGateReasons(question);
  const storedGateDecision = metadataText(gate.decision, review.status === 'failed' ? 'regenerate' : review.status === 'needs_review' ? 'quality_attention' : 'unknown');
  const gateDecision = derivedGate.hard.length
    ? 'regenerate'
    : derivedGate.human.length && (storedGateDecision === 'publishable' || storedGateDecision === 'manual_override_publishable')
      ? 'quality_attention'
      : storedGateDecision;
  const score = typeof review.score === 'number' ? review.score : typeof gate.score === 'number' ? gate.score : null;
  return {
    styleProfile: candidateStyleProfileEvidence(question),
    intendedUse: metadataText(generation.intendedUse, ''),
    profileAlignment: {
      status: metadataText(profileAlignment.status, 'not_checked'),
      score: Number.isFinite(alignmentScore) ? alignmentScore : null,
      reasons: Array.isArray(profileAlignment.reasons) ? profileAlignment.reasons.map((item) => String(item)).filter(Boolean) : [],
      targetProfile: recordFrom(profileAlignment.targetProfile),
      evidence: {
        styleProfileUsed: alignmentEvidence.styleProfileUsed === true,
        styleProfileConfidence: metadataText(alignmentEvidence.styleProfileConfidence, ''),
        inferredQuestionForm: metadataText(alignmentEvidence.inferredQuestionForm, ''),
        inferredCognitiveSkill: metadataText(alignmentEvidence.inferredCognitiveSkill, ''),
        inferredReadingLoad: metadataText(alignmentEvidence.inferredReadingLoad, ''),
        inferredCalculationLoad: metadataText(alignmentEvidence.inferredCalculationLoad, ''),
        actualDistractorTypes: Array.isArray(alignmentEvidence.actualDistractorTypes) ? alignmentEvidence.actualDistractorTypes.map((item) => String(item)).filter(Boolean) : []
      }
    },
    generator: {
      name: metadataText(generatorAgent.name, metadataText(generation.generator, 'generator')),
      provider: metadataText(generatorAgent.provider, metadataText(generation.generator, '-')),
      model: metadataText(generatorAgent.model, metadataText(generation.model, '-')),
      interactionId: metadataText(generationRun.generationInteractionId, metadataText(reviewRun.generationInteractionId))
    },
    reviewer: {
      name: metadataText(reviewerAgent.name, 'reviewer'),
      provider: metadataText(reviewerAgent.provider, metadataText(recordFrom(review.provider).provider, '-')),
      model: metadataText(reviewerAgent.model, metadataText(recordFrom(review.provider).model, '-')),
      status: metadataText(review.status, '-'),
      decision: metadataText(review.decision, '-'),
      score,
      interactionId: metadataText(
        reviewRun.approvalReviewInteractionId,
        metadataText(reviewRun.manualEditReviewInteractionId, metadataText(reviewRun.manualReviewInteractionId, metadataText(reviewRun.reviewInteractionId)))
      )
    },
    gate: {
      decision: gateDecision,
      publishable: derivedGate.hard.length === 0 && derivedGate.human.length === 0 && (gate.publishable === true || gateDecision === 'publishable' || gateDecision === 'manual_override_publishable'),
      reasons: [
        ...(Array.isArray(gate.reasons) ? gate.reasons.map((item) => String(item)).filter(Boolean) : []),
        ...derivedGate.hard,
        ...derivedGate.human
      ]
    },
    rubric,
    issues,
    dimensions
  };
}

export function subjectPracticeAutomationEvidence(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const review = recordFrom(question.reviewMetadata);
  const lastAutoRepair = recordFrom(generation.lastAutoRepair);
  const autoRepair = recordFrom(review.subjectPracticeAutoRepair);
  const autoRegenerate = recordFrom(review.subjectPracticeAutoRegenerate);
  const regenerateJobIds = Array.isArray(autoRegenerate.jobIds)
    ? autoRegenerate.jobIds
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
    : [];
  const repairStatus = metadataText(autoRepair.status || lastAutoRepair.status, '');
  const regenerateStatus = metadataText(autoRegenerate.status, '');
  return {
    hasEvidence: Boolean(repairStatus || regenerateStatus || Object.keys(lastAutoRepair).length),
    repair: {
      status: repairStatus,
      attempt: Number(lastAutoRepair.repairAttempt ?? autoRepair.repairAttempt) || null,
      mode: metadataText(lastAutoRepair.repairMode || autoRepair.repairMode, ''),
      error: metadataText(autoRepair.error, '')
    },
    regenerate: {
      status: regenerateStatus,
      reasonCode: metadataText(autoRegenerate.reasonCode, ''),
      jobIds: regenerateJobIds,
      skipped: Number(autoRegenerate.skipped) || 0,
      error: metadataText(autoRegenerate.error, '')
    }
  };
}

export function questionProductionVersionEvidence(question: AdminAIQuestioningQuestion) {
  const generation = recordFrom(question.generationMetadata);
  const review = recordFrom(question.reviewMetadata);
  const generatorAgent = recordFrom(generation.agent);
  const reviewerAgent = recordFrom(review.agent);
  const styleProfile = recordFrom(generation.styleProfile);
  const generatedAt = metadataText(generation.generatedAt, question.createdAt);
  const generatorPromptVersion = metadataText(
    generatorAgent.promptVersion,
    metadataText(generation.promptVersion, metadataText(generation.generatorPromptVersion, '-'))
  );
  const reviewerPromptVersion = metadataText(
    reviewerAgent.promptVersion,
    metadataText(review.promptVersion, metadataText(review.reviewerPromptVersion, '-'))
  );
  const profileVersion = metadataText(styleProfile.profileVersion, '');
  return {
    generatedAt,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    questionVersion: question.version,
    syllabusVersion: question.syllabusVersion,
    generationSchemaVersion: metadataText(generation.schemaVersion, '-'),
    sourceKind: metadataText(generation.sourceKind ?? generation.generationSource, 'syllabus'),
    generationMode: metadataText(generation.generationMode, ''),
    generatorPromptVersion,
    reviewerPromptVersion,
    styleProfileVersion: profileVersion,
    styleProfileId: metadataText(styleProfile.id, '')
  };
}

export function candidateLocalization(question: AdminAIQuestioningQuestion, language: 'zh' | 'en') {
  return recordFrom(recordFrom(question.generationMetadata).localizations)[language];
}

export function hasLocalizationContent(localization: Record<string, unknown>) {
  return Boolean(metadataText(localization.prompt, '')) ||
    questionOptionsFromUnknown(localization.options).length > 0 ||
    Boolean(metadataText(localization.explanation, ''));
}

function reviewIssueCode(issue: Record<string, unknown>) {
  return metadataText(issue.code, '').trim();
}

function reviewIssueSeverity(issue: Record<string, unknown>) {
  return metadataText(issue.severity, '').trim();
}

function reviewIssueText(issue: Record<string, unknown>) {
  const code = reviewIssueCode(issue);
  const fallbackMessage = metadataText(issue.message, code || '未知问题');
  const labels: Record<string, string> = {
    missing_prompt: '题干为空，不能入库。',
    not_enough_options: '选项不足，至少需要 4 个可辨认选项。',
    duplicate_option_ids: '选项编号重复，需要修正。',
    empty_option: '存在空选项，需要补完整。',
    duplicate_option_text: '有选项文字重复，学生无法区分。',
    equivalent_option_text: '有选项过于接近，容易变成格式辨析题，建议重新设计干扰项。',
    generic_distractor_text: '干扰项太泛，不能有效暴露常见误区。',
    invalid_correct_answer: '正确答案无法唯一匹配一个选项。',
    subject_mismatch: '题目科目和当前大纲知识点不一致。',
    topic_mismatch: '题目知识点和当前蓝图不一致。',
    syllabus_version_mismatch: '题目绑定的大纲版本和知识点版本不一致。',
    topic_not_published: '绑定的知识点还未发布，建议先确认大纲。',
    question_type_out_of_scope: '题型超出这个知识点允许范围。',
    difficulty_out_of_scope: '难度不在这个知识点设定范围内。',
    missing_exam_scope: '知识点缺少考试范围，系统只能弱校验。',
    excluded_scope_overlap: '题目碰到了大纲排除范围。',
    weak_syllabus_signal: '题干、选项或解析里缺少明确的大纲/知识点信号，需要质量复核确认是否贴合。',
    weak_explanation: '解析太短，不足以支撑答案。',
    explanation_answer_conflict: '解析中提到的答案和结构化答案冲突。',
    explanation_missing_answer_reference: '解析没有明确引用正确选项或答案内容。',
    missing_knowledge_tags: '缺少知识标签，后续统计和自适应推荐会变弱。',
    orphan_option_metadata: '选项错因 metadata 指向了不存在的选项。',
    incomplete_distractor_metadata: '错误选项缺少错因或干扰项意图。',
    correct_option_has_distractor_metadata: '正确选项不应带错因 metadata。',
    duplicate_distractor_intent: '多个错误选项使用了相同干扰意图。',
    compound_single_choice_option: '单选题选项包含“全部/都不/以上皆是”等复合表达，需要质量关注。',
    prompt_leakage: '题目含有泄题、占位符或 AI 生成痕迹。',
    duplicate_prompt_risk: '题干和题库已有题高度重复。',
    near_duplicate_prompt_risk: '题干疑似和同知识点已有题过近。',
    math_latex_cjk_in_formula: '数学定界符里混入了中文或自然语言说明，需把解释文字移到公式外。'
  };
  if (labels[code]) return labels[code];
  if (code.endsWith('_answer_mismatch')) return '程序化校验算出的答案和当前正确答案不一致。';
  if (code.endsWith('_option_conflict')) return '程序化校验发现正确结果出现在其他选项或多个选项里。';
  return fallbackMessage;
}

function gateReasonText(reason: string) {
  const labels: Record<string, string> = {
    fallback_generator: '这是 fallback 题，不能直接进入正式题库。',
    review_failed_dimension: '审题维度里存在未通过项。',
    review_failed: '审题流程标记为失败。',
    review_error_issue: '存在错误级审题问题。',
    reviewer_regenerate: 'LLM 审题建议重新生成。',
    reviewer_human_review: 'LLM 审题触发旧质量关注标记。',
    reviewer_quality_attention: 'LLM 审题建议进入质量关注处理。',
    reviewer_revise: 'LLM 审题建议先修订。',
    review_warning_issue: '存在提醒级审题问题。',
    weak_syllabus_signal: '在线模考题缺少足够明确的大纲/知识点信号，不能自动通过门禁。',
    smoke_candidate: '测试/Smoke 大纲生成的候选题不能进入正式题库。',
    trivial_arithmetic_candidate: '题目复杂度过低，不适合作为正式 CSCA 候选题。',
    missing_bilingual_localization: '缺少完整中英文同题版本，需要自动修复或重新生成后才能入库。',
    math_text_invalid: '数学公式文本无法稳定渲染，需要先修复 LaTeX 后才能入库。',
    math_latex_unbalanced_delimiters: '数学公式存在未配对的括号、花括号或美元符定界符。',
    math_latex_invalid_fraction: '分式 LaTeX 格式不完整，需要使用 \\frac{分子}{分母}。',
    math_latex_invalid_sqrt: '根号 LaTeX 格式不完整，需要使用 \\sqrt{内容}。',
    math_latex_unpaired_left_right: '公式中的 \\left 和 \\right 没有成对出现。',
    math_latex_cjk_in_formula: '数学定界符里混入了中文或自然语言说明，需要只保留公式，把解释文字移到公式外。',
    style_alignment_failed: '题目风格明显偏离真题画像，建议重新生成。',
    style_alignment_low: '题目风格和真题画像贴合度偏低，需要质量关注。',
    style_profile_absent_for_subject_practice: '没有使用真题画像生成，需要质量关注后才能入库。',
    profile_alignment_failed: '题目没有贴合本次目标画像，建议重新生成。',
    profile_alignment_warning: '题目和本次目标画像存在偏差，需要质量关注。',
    exam_like_difficulty_low: '题目难度不像目标考试难度，需要质量关注。',
    past_paper_similarity_high: '题目和真题画像/样本结构过近，必须重新生成。',
    past_paper_similarity_medium: '题目和真题画像/样本存在相似风险，需要质量关注。',
    source_similarity_high: '题目和自动纳入的真题样本过近，必须重新生成。',
    source_similarity_medium: '题目和自动纳入的真题样本相似度偏高，需要质量关注。'
  };
  return labels[reason] ?? reason;
}

export function candidateReviewExplanation(question: AdminAIQuestioningQuestion, evidence = candidateAgentEvidence(question)) {
  const issues = evidence.issues.map(recordFrom);
  const errors = issues.filter((issue) => reviewIssueSeverity(issue) === 'error');
  const warnings = issues.filter((issue) => reviewIssueSeverity(issue) === 'warning');
  const mainIssues = [...errors, ...warnings].slice(0, 3);
  const gateReasons = evidence.gate.reasons.map(gateReasonText);
  const issueTexts = mainIssues.map(reviewIssueText);
  const isFallback = candidateUsesFallback(question);
  const title = isFallback
    ? '不能入库：这是本地 fallback 题'
    : evidence.gate.decision === 'regenerate'
      ? '建议重生'
      : evidence.gate.decision === 'needs_edit'
        ? '需先修改'
        : evidence.gate.decision === 'human_review' || evidence.gate.decision === 'quality_attention'
          ? '质量关注'
          : evidence.gate.publishable
            ? '可入库'
            : '待复审';
  const detail = isFallback
    ? '请配置真实 AI Provider 后重新生成候选题。'
    : issueTexts[0] || gateReasons[0] || (evidence.gate.publishable ? '审题门禁已通过，可以进入入库流程。' : '还没有足够审题证据，需要复审或质量关注处理。');
  return {
    title,
    detail,
    tone: isFallback || evidence.gate.decision === 'regenerate' ? 'danger' : evidence.gate.decision === 'needs_edit' || evidence.gate.decision === 'human_review' || evidence.gate.decision === 'quality_attention' ? 'warning' : evidence.gate.publishable ? 'ok' : 'info',
    gateReasons,
    issueTexts
  };
}

export function styleProfileFreshnessText(freshness: ReturnType<typeof candidateStyleProfileEvidence>['freshness']) {
  if (freshness.stale) {
    const missing = freshness.missingApprovedSampleCount ?? 0;
    return missing > 0 ? `画像需刷新 · 新增 ${missing} 个样本` : '画像需刷新';
  }
  if (freshness.currentApprovedSampleCount === null) return '画像新鲜度未检查';
  return '画像样本已同步';
}

export function gateBlocksPublish(question: AdminAIQuestioningQuestion) {
  const evidence = candidateAgentEvidence(question);
  return ['regenerate', 'needs_edit'].includes(evidence.gate.decision);
}
