import type { AdminAIQuestioningSourceQuestion } from '../../../lib/api-types';
import { MathContent } from '../../MathContent';
import { sourceTopicMappingEvidence } from './questionEvidence';

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function autoProfileStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: '待自动处理',
    processing: '自动处理中',
    retry_pending: '待重试',
    auto_approved: '已自动纳入画像',
    excluded: '已自动排除',
    excluded_retry_exhausted: '重试耗尽'
  };
  return labels[status ?? ''] ?? status ?? '待自动处理';
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
}

function sourceQuestionProfileSummary(question: AdminAIQuestioningSourceQuestion) {
  const analysis = recordFrom(question.analysis);
  const profile = recordFrom(analysis.profile);
  const stemPattern = recordFrom(profile.stemPattern ?? analysis.stemPattern);
  const optionPattern = recordFrom(profile.optionPattern ?? analysis.optionPattern);
  const questionForm = String(profile.questionForm ?? analysis.questionForm ?? '').trim();
  const cognitiveSkill = String(profile.cognitiveSkill ?? analysis.cognitiveSkill ?? '').trim();
  const readingLoad = String(profile.readingLoad ?? analysis.readingLoad ?? stemPattern.length ?? '').trim();
  const calculationLoad = String(profile.calculationLoad ?? analysis.calculationLoad ?? '').trim();
  const estimatedTimeSeconds = Number(profile.estimatedTimeSeconds ?? analysis.estimatedTimeSeconds);
  const confidence = String(profile.profileConfidence ?? analysis.profileConfidence ?? '').trim();
  const distractorTypes = stringArray(optionPattern.distractorTypes).slice(0, 3);
  const commonMisconceptions = stringArray(optionPattern.commonMisconceptions).slice(0, 3);
  const profileIssues = stringArray(profile.profileIssues ?? analysis.profileIssues).slice(0, 2);
  const chips = [
    questionForm ? `题型 ${questionForm}` : null,
    cognitiveSkill ? `技能 ${cognitiveSkill}` : null,
    readingLoad ? `阅读 ${readingLoad}` : null,
    calculationLoad ? `计算 ${calculationLoad}` : null,
    Number.isFinite(estimatedTimeSeconds) && estimatedTimeSeconds > 0 ? `估时 ${estimatedTimeSeconds}s` : null,
    confidence ? `置信度 ${confidence}` : null
  ].filter(Boolean) as string[];
  return { chips, distractorTypes, commonMisconceptions, profileIssues };
}

type SourceQuestionMappingCardProps = {
  question: AdminAIQuestioningSourceQuestion;
};

export function SourceQuestionMappingCard({
  question
}: SourceQuestionMappingCardProps) {
  const mappingEvidence = sourceTopicMappingEvidence(question);
  const topSuggestion = mappingEvidence.suggestions[0] ?? null;
  const isDisplayRestricted = question.sourceDisplayRestricted === true;
  const autoProfileStatus = question.autoProfileStatus ?? 'pending';
  const autoProfileFailure = question.autoProfileFailureReason || question.autoProfileFailureType;
  const profileSummary = sourceQuestionProfileSummary(question);

  return (
    <div className="admin-source-question-card">
      <strong>
        {question.questionNumber}. <MathContent text={question.promptText || `原题内容受限 · ${question.promptHash}`} />
      </strong>
      <span>{question.subject} · {question.topicTitle || '未映射考点'} · 自动画像 {autoProfileStatusLabel(autoProfileStatus)} · 分析 {question.analysisStatus}</span>
      {autoProfileFailure && (
        <p className="admin-source-topic-status">自动画像原因：{autoProfileFailure}</p>
      )}
      {isDisplayRestricted && (
        <p className="admin-source-topic-status">
          原题展示受 usage policy 限制，系统只使用解析画像、题目哈希和已确认 metadata 参与治理。
        </p>
      )}
      {profileSummary.chips.length > 0 && (
        <p className="admin-source-topic-status">画像：{profileSummary.chips.join(' · ')}</p>
      )}
      {(profileSummary.distractorTypes.length > 0 || profileSummary.commonMisconceptions.length > 0) && (
        <p className="admin-source-topic-status">
          干扰项：{profileSummary.distractorTypes.join(' / ') || '-'}
          {profileSummary.commonMisconceptions.length > 0 ? ` · 错因 ${profileSummary.commonMisconceptions.join(' / ')}` : ''}
        </p>
      )}
      {profileSummary.profileIssues.length > 0 && (
        <p className="admin-source-topic-status">画像问题：{profileSummary.profileIssues.join(' / ')}</p>
      )}
      {mappingEvidence.suggestions.length > 0 && (
        <div className="admin-source-topic-suggestion">
          <div>
            <strong>自动映射结果：{topSuggestion?.topicCode} {topSuggestion?.topicTitle ? `· ${topSuggestion.topicTitle}` : ''}</strong>
            <span>{formatPercent(topSuggestion?.confidence)} · {topSuggestion?.module || '未分模块'}</span>
          </div>
          {topSuggestion?.reason && <p>{topSuggestion.reason}</p>}
          {mappingEvidence.suggestions.length > 1 && (
            <p className="admin-source-topic-status">
              备选：{mappingEvidence.suggestions.slice(1, 4).map((suggestion) => `${suggestion.topicCode} ${formatPercent(suggestion.confidence)}`).join(' / ')}
            </p>
          )}
        </div>
      )}
      {!mappingEvidence.suggestions.length && mappingEvidence.status && (
        <p className="admin-source-topic-status">AI 映射状态：{mappingEvidence.status}{mappingEvidence.error ? ` · ${mappingEvidence.error}` : ''}</p>
      )}
    </div>
  );
}
