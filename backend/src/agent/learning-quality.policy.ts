export type LearningQualityInput = {
  evidenceCount: number;
  evidencedTopicCount: number;
  totalTopicCount: number;
  projectionPending: boolean;
  decisionAvailable: boolean;
  prescriptions: Array<{ prescriptionId: string }>;
  outcomes: Array<{
    prescriptionId: string;
    decision: string;
    targetAccuracy?: number | null;
    verification?: boolean;
  }>;
  validations: Array<{ status: string; result: string | null }>;
  contradictions: {
    strongWithActiveErrorCount: number;
    weakWithStableValidationCount: number;
  };
  supply: null | {
    status: 'sufficient' | 'limited' | 'empty' | 'unknown' | 'not_required';
    requestedCount: number;
    availableCount: number | null;
    teachingAssetCount?: number;
    conceptCardCount?: number;
    explainedQuestionCount?: number;
  };
};

const percent = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;

export function buildLearningQualitySnapshot(input: LearningQualityInput) {
  const publishedIds = new Set(input.prescriptions.map((item) => item.prescriptionId));
  const byDecision = (decision: string) => new Set(input.outcomes
    .filter((item) => item.decision === decision && publishedIds.has(item.prescriptionId))
    .map((item) => item.prescriptionId));
  const shown = byDecision('shown');
  const accepted = byDecision('accepted');
  const terminal = new Set(input.outcomes
    .filter((item) => ['completed', 'failed', 'abandoned', 'superseded'].includes(item.decision) && publishedIds.has(item.prescriptionId))
    .map((item) => item.prescriptionId));
  const completed = byDecision('completed');
  const positive = new Set(input.outcomes.filter((item) => item.decision === 'completed'
    && publishedIds.has(item.prescriptionId)
    && (item.verification === true || Number(item.targetAccuracy ?? 0) >= 80))
    .map((item) => item.prescriptionId));
  const validations = {
    stable: input.validations.filter((item) => item.status === 'completed' && item.result === 'stable').length,
    notStable: input.validations.filter((item) => item.status === 'completed' && item.result === 'not_stable').length,
    inconclusive: input.validations.filter((item) => item.status === 'completed' && item.result === 'inconclusive').length,
    pending: input.validations.filter((item) => item.status !== 'completed').length
  };
  const status = input.evidenceCount === 0
    ? 'cold_start'
    : input.evidenceCount < 5 || input.evidencedTopicCount < 2
      ? 'collecting'
      : validations.stable + validations.notStable < 2
        ? 'validating'
        : 'calibrated';
  const alerts: Array<{ code: string; tone: 'info' | 'warning'; title: string; body: string; action: 'practice' | 'review' | 'wait' }> = [];
  if (status === 'cold_start') alerts.push({ code: 'cold_start', tone: 'info', title: '先建立真实基线', body: '还没有足够作答证据，系统会先安排覆盖多个知识点的短练习，不会伪装成个性化推荐。', action: 'practice' });
  else if (status === 'collecting') alerts.push({ code: 'sparse_evidence', tone: 'info', title: '个性化仍在积累证据', body: '当前建议可信度有限；继续完成少量独立作答后再判断稳定掌握。', action: 'practice' });
  if (input.projectionPending) alerts.push({ code: 'projection_pending', tone: 'info', title: '最新证据正在同步', body: '作答已经保存，知识状态尚未更新完成；可以复盘错题，暂不重复生成新判断。', action: 'wait' });
  if (!input.decisionAvailable && input.evidenceCount > 0) alerts.push({ code: 'decision_unavailable', tone: 'warning', title: '个性化建议暂不可用', body: '仍可继续自由练习或复盘错题，系统不会用旧结论冒充最新建议。', action: 'practice' });
  if (input.supply && (input.supply.status === 'limited' || input.supply.status === 'empty')) alerts.push({ code: 'supply_gap', tone: 'warning', title: '当前建议的题源不足', body: `需要 ${input.supply.requestedCount} 题，目前可用 ${input.supply.availableCount ?? 0} 题；建议先复盘或改练其他知识点。`, action: 'review' });
  if (input.supply && input.supply.status !== 'not_required'
    && (input.supply.teachingAssetCount ?? 0) + (input.supply.conceptCardCount ?? 0) + (input.supply.explainedQuestionCount ?? 0) === 0) {
    alerts.push({ code: 'teaching_content_gap', tone: 'warning', title: '这个知识点缺少可用讲解', body: '当前没有已审核的讲解卡、教学动画或带解析题目；可以继续做题，但系统不会伪装成已有教学内容。', action: 'practice' });
  }
  const contradictionCount = input.contradictions.strongWithActiveErrorCount + input.contradictions.weakWithStableValidationCount;
  if (contradictionCount > 0) alerts.push({ code: 'calibration_attention', tone: 'warning', title: '发现需要重新校准的判断', body: `有 ${contradictionCount} 个知识点的掌握状态与后续错误或独立验证不一致，系统会优先再次验证。`, action: 'review' });

  return {
    schemaVersion: '1' as const,
    policyVersion: 'learning-quality-v1' as const,
    status,
    evidence: {
      acceptedCount: input.evidenceCount,
      evidencedTopicCount: input.evidencedTopicCount,
      totalTopicCount: input.totalTopicCount,
      projectionPending: input.projectionPending
    },
    recommendationFunnel: {
      publishedCount: publishedIds.size,
      shownCount: shown.size,
      acceptedCount: accepted.size,
      terminalCount: terminal.size,
      completedCount: completed.size,
      positiveOutcomeCount: positive.size,
      followThroughRate: percent(accepted.size, shown.size || publishedIds.size),
      completionRate: percent(completed.size, accepted.size),
      positiveOutcomeRate: percent(positive.size, completed.size)
    },
    validation: { ...validations, contradictionCount, ...input.contradictions },
    supply: input.supply,
    alerts,
    provenance: {
      generatedByAI: false as const,
      source: 'learning_evidence_and_outcomes' as const,
      note: 'AI 可辅助讲解，但不直接修改掌握状态、校准结论或推荐效果。'
    }
  };
}
