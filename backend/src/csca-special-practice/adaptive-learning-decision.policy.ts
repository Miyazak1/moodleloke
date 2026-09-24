export type AdaptiveDecisionTopicInput = {
  topicId: number;
  code: string;
  title: string;
  total: number;
  correct: number;
  unanswered: number;
  independentCorrect: number;
  assistedCorrect: number;
  firstAttemptCount: number;
  averageSeconds: number | null;
  state: {
    source: 'learning_state_v2' | 'legacy_mastery' | 'round_only';
    mastery: number | null;
    confidence: number | null;
    independence: number | null;
    retention: number | null;
    fluency: number | null;
    transfer: number | null;
    consistency: number | null;
    coverage: number | null;
    evidenceCount: number;
    stateVersion: string | null;
  };
  reviewPattern: null | {
    id: number;
    patternType: string;
    status: string;
    recurrenceCount: number;
    nextReviewAt: string | null;
    consecutiveVerificationPassCount: number;
  };
};

export type AdaptiveLearningDecision = {
  schemaVersion: '1';
  policyVersion: 'adaptive-mastery-decision-v1';
  generatedByAI: false;
  source: 'rules_and_learning_evidence';
  adaptationPending: boolean;
  status: 'needs_review' | 'needs_verification' | 'building' | 'verified_mastery';
  headline: string;
  explanation: string;
  evidenceBasis: {
    answeredCount: number;
    firstAttemptCount: number;
    independentCorrectCount: number;
    assistedCorrectCount: number;
    averageSeconds: number | null;
    stateSource: 'learning_state_v2' | 'legacy_mastery' | 'round_only' | 'mixed';
  };
  topics: Array<AdaptiveDecisionTopicInput & {
    status: 'needs_review' | 'needs_verification' | 'building' | 'verified_mastery';
    reasons: string[];
  }>;
  nextStep: {
    type: 'review_mistakes' | 'targeted_practice' | 'delayed_verification' | 'continue_practice' | 'broaden_coverage';
    label: string;
    reason: string;
    subject: 'math' | 'physics' | 'chemistry';
    topicId: number | null;
    reviewItemId: number | null;
    patternType: string | null;
    dueAt: string | null;
    questionCount: number;
  };
};

function roundedAverage(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
}

function classifyTopic(topic: AdaptiveDecisionTopicInput) {
  const reasons: string[] = [];
  const wrong = topic.total - topic.correct;
  if (wrong > 0) reasons.push(topic.unanswered > 0 ? '本轮存在未作答题' : '本轮仍有错误');
  if (topic.reviewPattern?.status === 'active') reasons.push(`同类错误已累计 ${topic.reviewPattern.recurrenceCount} 次`);
  if (wrong > 0 || topic.reviewPattern?.status === 'active') {
    return { status: 'needs_review' as const, reasons };
  }

  if (topic.assistedCorrect > 0) reasons.push('正确作答使用了提示或解析');
  if (topic.reviewPattern?.status === 'improving') reasons.push('已有修复证据，仍需跨时间独立验证');
  if ((topic.state.retention ?? 0) < 0.6) reasons.push('跨时间保持证据不足');
  if ((topic.state.independence ?? 0) < 0.7) reasons.push('独立作答证据不足');
  if (topic.assistedCorrect > 0 || topic.reviewPattern?.status === 'improving') {
    return { status: 'needs_verification' as const, reasons };
  }

  const verified = (topic.state.mastery ?? 0) >= 0.75
    && (topic.state.confidence ?? 0) >= 0.55
    && (topic.state.independence ?? 0) >= 0.7
    && (topic.state.retention ?? 0) >= 0.6
    && topic.state.evidenceCount >= 3;
  if (verified) return { status: 'verified_mastery' as const, reasons: ['多次可信证据达到掌握阈值'] };

  if (topic.independentCorrect > 0) reasons.push('本轮已独立答对，但证据次数或保持时间仍不足');
  if ((topic.state.confidence ?? 0) < 0.55) reasons.push('当前证据置信度不足');
  return { status: 'building' as const, reasons: reasons.length ? reasons : ['需要继续积累独立作答证据'] };
}

export function decideAdaptiveLearning(input: {
  subject: 'math' | 'physics' | 'chemistry';
  adaptationPending: boolean;
  topics: AdaptiveDecisionTopicInput[];
}): AdaptiveLearningDecision {
  const topics = input.topics.map((topic) => ({ ...topic, ...classifyTopic(topic) }));
  const focus = topics.find((topic) => topic.status === 'needs_review')
    ?? topics.find((topic) => topic.status === 'needs_verification')
    ?? topics.find((topic) => topic.status === 'building')
    ?? topics[0];
  const status = topics.some((topic) => topic.status === 'needs_review')
    ? 'needs_review' as const
    : topics.some((topic) => topic.status === 'needs_verification')
      ? 'needs_verification' as const
      : topics.length > 0 && topics.every((topic) => topic.status === 'verified_mastery')
        ? 'verified_mastery' as const
        : 'building' as const;
  const dueAt = focus?.reviewPattern?.nextReviewAt ?? null;
  const dueTime = dueAt ? Date.parse(dueAt) : Number.NaN;
  const futureVerification = status === 'needs_verification' && Number.isFinite(dueTime) && dueTime > Date.now();
  const nextType = status === 'needs_review'
    ? 'review_mistakes' as const
    : futureVerification
      ? 'delayed_verification' as const
      : status === 'needs_verification'
        ? 'targeted_practice' as const
        : status === 'verified_mastery'
          ? 'broaden_coverage' as const
          : 'continue_practice' as const;
  const copy = status === 'needs_review'
    ? { headline: '先修复本轮暴露的薄弱点', explanation: '本轮错误会进入复习队列；完成复盘后还需要用新题独立验证。' }
    : status === 'needs_verification'
      ? { headline: '已经改善，但还不能算稳定掌握', explanation: futureVerification ? '当前已有一次修复证据，系统会在间隔后安排新题再次验证。' : '需要在不看提示和解析的情况下，用新题完成独立验证。' }
      : status === 'verified_mastery'
        ? { headline: '已有足够证据确认稳定掌握', explanation: '多次独立作答、保持性和置信度均达到规则阈值，可以扩大知识覆盖。' }
        : { headline: '本轮表现有效，继续积累可信证据', explanation: '一次答对不等于掌握；系统会继续观察独立性、保持性和题目难度。' };
  const nextCopy = nextType === 'review_mistakes'
    ? { label: '复习本轮错题', reason: focus ? `先理解“${focus.title}”的错误原因，再做同类新题。` : '先复习本轮错题。' }
    : nextType === 'delayed_verification'
      ? { label: '等待间隔验证', reason: '立即重复容易形成短时记忆，达到复习时间后再用新题验证。' }
      : nextType === 'targeted_practice'
        ? { label: '开始独立验证', reason: focus ? `使用“${focus.title}”的新题验证是否真正掌握。` : '使用新题完成独立验证。' }
        : nextType === 'broaden_coverage'
          ? { label: '扩大知识覆盖', reason: '当前知识点已形成稳定证据，下一轮可以覆盖新的知识点。' }
          : { label: '继续巩固', reason: '继续使用新题积累独立、稳定的作答证据。' };
  const sources = new Set(input.topics.map((topic) => topic.state.source));
  return {
    schemaVersion: '1',
    policyVersion: 'adaptive-mastery-decision-v1',
    generatedByAI: false,
    source: 'rules_and_learning_evidence',
    adaptationPending: input.adaptationPending,
    status,
    ...copy,
    evidenceBasis: {
      answeredCount: topics.reduce((sum, topic) => sum + topic.total - topic.unanswered, 0),
      firstAttemptCount: topics.reduce((sum, topic) => sum + topic.firstAttemptCount, 0),
      independentCorrectCount: topics.reduce((sum, topic) => sum + topic.independentCorrect, 0),
      assistedCorrectCount: topics.reduce((sum, topic) => sum + topic.assistedCorrect, 0),
      averageSeconds: roundedAverage(topics.map((topic) => topic.averageSeconds)),
      stateSource: sources.size === 1 ? (sources.values().next().value ?? 'round_only') : 'mixed'
    },
    topics,
    nextStep: {
      type: nextType,
      ...nextCopy,
      subject: input.subject,
      topicId: focus?.topicId ?? null,
      reviewItemId: focus?.reviewPattern?.id ?? null,
      patternType: focus?.reviewPattern?.patternType ?? null,
      dueAt,
      // A normal follow-up batch should be long enough to provide useful
      // evidence and should match the product's standard five-question batch.
      // Spaced verification remains a deliberately small three-question check.
      questionCount: nextType === 'delayed_verification' ? 3 : 5
    }
  };
}
