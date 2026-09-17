import type {
  AdminAIQuestioningAgentRun,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type { BulkApproveScope } from './candidateBulkActions';
import {
  candidateAgentEvidence,
  candidateUsesFallback,
  gateBlocksPublish,
  isMockExamCandidate
} from './questionEvidence';
import { recordFrom } from './questionData';
import { metadataText } from './questionFormatting';

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    missing_blueprint: '缺出题蓝图',
    needs_candidates: '缺合格题',
    needs_publish: '待入库',
    needs_quality_review: '质量复核',
    healthy: '健康',
    pending_review: '待审核',
    review_failed: '复审失败',
    approved: '已审核',
    rejected: '已拒绝',
    archived: '已归档',
    queued: '排队中',
    running: '生成中',
    succeeded: '已生成',
    failed: '生成失败',
    blocked: '已阻塞'
  };
  return labels[status] ?? status;
}

export function canApproveCandidate(question: AdminAIQuestioningQuestion) {
  return ['draft', 'pending_review', 'review_failed'].includes(question.status)
    && !candidateUsesFallback(question)
    && !gateBlocksPublish(question);
}

export function canReviewCandidate(question: AdminAIQuestioningQuestion) {
  return ['draft', 'pending_review', 'review_failed'].includes(question.status);
}

export function canEditCandidate(question: AdminAIQuestioningQuestion) {
  return ['draft', 'pending_review', 'review_failed'].includes(question.status);
}

export function canRejectCandidate(question: AdminAIQuestioningQuestion) {
  return ['draft', 'pending_review', 'review_failed'].includes(question.status);
}

export function canArchiveCandidate(question: AdminAIQuestioningQuestion) {
  return question.status !== 'archived';
}

export function canBulkApproveCandidate(question: AdminAIQuestioningQuestion, scope: BulkApproveScope) {
  if (!canApproveCandidate(question)) return false;
  const decision = candidateAgentEvidence(question).gate.decision;
  if (scope === 'gate_passed') return decision === 'publishable';
  return decision === 'publishable' || decision === 'human_review' || decision === 'quality_attention' || decision === 'manual_override_publishable';
}

export function approvedCandidateLabel(question: AdminAIQuestioningQuestion) {
  if (question.status !== 'approved') return null;
  if (isMockExamCandidate(question)) return '已审核 · 可装配模考草稿';
  return question.sourceQuestionId ? `已发布到练习 #${question.sourceQuestionId}` : '已审核';
}

export function agentRunTypeLabel(type: string) {
  const labels: Record<string, string> = {
    question_generation: '生成候选',
    question_review: '首次审题',
    question_manual_review: '质量复核',
    question_manual_edit_review: '编辑后质量复核',
    question_approval_review: '旧版发布前复审'
  };
  return labels[type] ?? type;
}

export function agentRunSummary(run: AdminAIQuestioningAgentRun) {
  const structured = recordFrom(run.structuredOutput);
  const agent = recordFrom(structured.agent);
  const payload = recordFrom(structured.payload);
  const score = typeof payload.score === 'number' ? `${payload.score} 分` : '';
  const decision = metadataText(payload.decision);
  const issues = Array.isArray(payload.issues) ? payload.issues.map(recordFrom).slice(0, 3) : [];
  return {
    agentName: metadataText(agent.name, agentRunTypeLabel(run.type)),
    decision,
    score,
    issues: issues.map((issue) => `${metadataText(issue.severity)}:${metadataText(issue.code)}`)
  };
}
