import { useState } from 'react';
import { AdminActionBar, AdminPanel, AdminPanelHeader } from '../AdminWorkbench';
import type {
  AdminAIQuestioningExamSeriesProfile,
  AdminAIQuestioningProfileDistributionItem,
  AdminAIQuestioningGenerationProfile,
  AdminAIQuestioningStyleProfile
} from '../../../lib/api-types';
import { ProfileDistributionChart } from './ProfileVisualizationPanel';
import { recordFrom } from './questionData';

export type StyleProfilePanelProps = {
  styleProfiles: AdminAIQuestioningStyleProfile[];
  examSeriesProfiles: AdminAIQuestioningExamSeriesProfile[];
  generationProfiles: AdminAIQuestioningGenerationProfile[];
  approvedQuestionCount: number;
  onGenerateExamSeriesProfile: () => void;
  onGenerateGenerationProfiles: () => void;
  onRefreshQuestionVersionGovernance: () => void;
  onActivateExamSeriesProfile: (profileId: number) => void;
  onActivateGenerationProfile: (profileId: number) => void;
  isExamSeriesProfileBusy: boolean;
  isGenerationProfileBusy: boolean;
  isQuestionVersionGovernanceBusy: boolean;
  isExamSeriesProfileActivateBusy: (profileId: number) => boolean;
  isGenerationProfileActivateBusy: (profileId: number) => boolean;
};

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableRecordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function ratioText(value: number) {
  return `${Math.round(value * 100)}%`;
}

function distributionFromRecord(
  value: unknown,
  sampleSize: number,
  labels: Record<string, string> = {},
  limit = 10
): AdminAIQuestioningProfileDistributionItem[] {
  const source = recordFrom(value) ?? {};
  const allEntries = Object.entries(source)
    .map(([key, rawValue]) => ({ key, value: numberValue(rawValue) }))
    .filter((item) => item.key && item.value > 0)
    .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));
  const valueTotal = allEntries.reduce((sum, item) => sum + item.value, 0);
  const valuesLookLikeRatios = valueTotal > 0 && valueTotal <= 1.05;
  return allEntries.slice(0, limit).map((item) => {
    const ratio = valuesLookLikeRatios ? item.value : item.value / valueTotal;
    const count = valuesLookLikeRatios ? Math.max(1, Math.round(item.value * sampleSize)) : Math.round(item.value);
    return {
      key: item.key,
      label: labels[item.key] ?? item.key,
      count,
      ratio: Number(ratio.toFixed(4))
    };
  });
}

function distributionFromWeightedList(
  value: unknown,
  sampleSize: number,
  labels: Record<string, string> = {},
  limit = 10
): AdminAIQuestioningProfileDistributionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = recordFrom(item) ?? {};
      const key = String(record.key ?? record.label ?? '').trim();
      const count = numberValue(record.count);
      const weight = numberValue(record.weight);
      const ratio = weight > 0 && weight <= 1 ? weight : sampleSize > 0 && count > 0 ? count / sampleSize : 0;
      return {
        key,
        label: labels[key] ?? key,
        count: count > 0 ? count : Math.max(1, Math.round(ratio * sampleSize)),
        ratio: Number(ratio.toFixed(4))
      };
    })
    .filter((item) => item.key && item.ratio > 0)
    .sort((left, right) => right.ratio - left.ratio || left.key.localeCompare(right.key))
    .slice(0, limit);
}

function profileDistributions(profile: unknown, sampleSize: number) {
  const profileRecord = recordFrom(profile) ?? {};
  return {
    difficulty: distributionFromRecord(profileRecord.difficultyDistribution, sampleSize),
    questionForm: distributionFromRecord(profileRecord.questionFormDistribution, sampleSize),
    cognitiveSkill: distributionFromRecord(profileRecord.cognitiveSkillDistribution, sampleSize),
    readingLoad: distributionFromRecord(profileRecord.readingLoadDistribution, sampleSize),
    calculationLoad: distributionFromRecord(profileRecord.calculationLoadDistribution, sampleSize),
    answer: distributionFromRecord(profileRecord.answerDistribution, sampleSize)
  };
}

function normalizedTargetDistributions(target: unknown) {
  const targetRecord = recordFrom(target) ?? {};
  const distributions = recordFrom(targetRecord.distributions) ?? {};
  const targetCount = numberValue(targetRecord.targetCount, 48);
  return {
    targetCount,
    difficulty: distributionFromRecord(distributions.difficulty, targetCount),
    questionForm: distributionFromRecord(distributions.questionForm, targetCount),
    cognitiveSkill: distributionFromRecord(distributions.cognitiveSkill, targetCount),
    readingLoad: distributionFromRecord(distributions.readingLoad, targetCount),
    calculationLoad: distributionFromRecord(distributions.calculationLoad, targetCount),
    answer: distributionFromRecord(distributions.answer, targetCount)
  };
}

function rotationTopicsFromSessionSummary(value: unknown, limit = 10): AdminAIQuestioningProfileDistributionItem[] {
  const summary = recordFrom(value) ?? {};
  const sessions = Array.isArray(summary.sessions) ? summary.sessions : [];
  if (sessions.length <= 1) return [];
  const topicCounts = new Map<string, number>();
  for (const session of sessions) {
    const sessionRecord = recordFrom(session) ?? {};
    const seen = new Set<string>();
    const topics = Array.isArray(sessionRecord.topics) ? sessionRecord.topics : [];
    for (const topic of topics) {
      const topicRecord = recordFrom(topic) ?? {};
      const key = String(topicRecord.key ?? '').trim();
      if (key) seen.add(key);
    }
    for (const key of seen) topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
  }
  return Array.from(topicCounts.entries())
    .filter(([, count]) => count > 0 && count < sessions.length)
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: key,
      count,
      ratio: Number((count / sessions.length).toFixed(4))
    }));
}

function sourceContributionsFromSessionSummary(value: unknown, limit = 12): AdminAIQuestioningProfileDistributionItem[] {
  const summary = recordFrom(value) ?? {};
  const sessions = Array.isArray(summary.sessions) ? sessionsFromUnknown(summary.sessions) : [];
  const total = sessions.reduce((sum, session) => sum + session.questionCount, 0);
  return sessions
    .filter((session) => session.questionCount > 0)
    .sort((left, right) => {
      const leftKey = `${left.examYear ?? 9999}:${left.examSession || ''}:${left.documentId}`;
      const rightKey = `${right.examYear ?? 9999}:${right.examSession || ''}:${right.documentId}`;
      return leftKey.localeCompare(rightKey);
    })
    .slice(0, limit)
    .map((session) => ({
      key: String(session.documentId),
      label: [
        session.examYear,
        session.examSession,
        session.title || `源卷 #${session.documentId}`
      ].filter(Boolean).join(' · '),
      count: session.questionCount,
      ratio: total > 0 ? Number((session.questionCount / total).toFixed(4)) : 0
    }));
}

function sessionsFromUnknown(value: unknown): Array<{
  documentId: number;
  title: string;
  examYear: number | null;
  examSession: string;
  questionCount: number;
}> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = recordFrom(item) ?? {};
    return {
      documentId: numberValue(record.documentId),
      title: String(record.title ?? '').trim(),
      examYear: numberValue(record.examYear) || null,
      examSession: String(record.examSession ?? '').trim(),
      questionCount: numberValue(record.questionCount)
    };
  }).filter((item) => item.documentId > 0);
}

function ProfileEvidencePanel({
  title,
  metrics,
  distributions,
  notes
}: {
  title: string;
  metrics: Array<{ label: string; value: string | number }>;
  distributions: Array<{ title: string; items: AdminAIQuestioningProfileDistributionItem[] }>;
  notes?: string[];
}) {
  return (
    <section className="admin-profile-visualization-panel">
      <strong>{title}</strong>
      <div className="metric-grid four">
        {metrics.map((metric) => (
          <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>
        ))}
      </div>
      {notes && notes.length > 0 && (
        <div className="admin-profile-diagnostics">
          {notes.map((note) => (
            <p key={note} className="admin-profile-diagnostic warning">
              <strong>需关注</strong>
              <span>{note}</span>
            </p>
          ))}
        </div>
      )}
      <div className="admin-profile-chart-grid">
        {distributions.map((chart) => (
          <ProfileDistributionChart key={chart.title} title={chart.title} items={chart.items} />
        ))}
      </div>
    </section>
  );
}

export function StyleProfilePanel({
  styleProfiles,
  examSeriesProfiles,
  generationProfiles,
  approvedQuestionCount,
  onGenerateExamSeriesProfile,
  onGenerateGenerationProfiles,
  onRefreshQuestionVersionGovernance,
  onActivateExamSeriesProfile,
  onActivateGenerationProfile,
  isExamSeriesProfileBusy,
  isGenerationProfileBusy,
  isQuestionVersionGovernanceBusy,
  isExamSeriesProfileActivateBusy,
  isGenerationProfileActivateBusy
}: StyleProfilePanelProps) {
  const [expandedProfileKey, setExpandedProfileKey] = useState<string | null>(null);
  const activeSubjectPracticeProfile = generationProfiles.find((profile) => profile.useCase === 'subject_practice' && profile.status === 'active');
  const activeMockExamProfile = generationProfiles.find((profile) => profile.useCase === 'online_mock_exam' && profile.status === 'active');
  const activeSeriesProfile = examSeriesProfiles.find((profile) => profile.status === 'active') ?? null;
  const visibleExamSeriesProfiles = examSeriesProfiles.filter((profile) => profile.status !== 'archived');
  const archivedExamSeriesProfiles = examSeriesProfiles.filter((profile) => profile.status === 'archived');
  function renderExamSeriesProfile(profile: AdminAIQuestioningExamSeriesProfile, options: { archived?: boolean } = {}) {
    const trendProfile = recordFrom(profile.trendProfile) ?? {};
    const profileLike = recordFrom(trendProfile.profileLike) ?? {};
    const trendSignals = recordFrom(trendProfile.trendSignals) ?? {};
    const normalizedTargets = recordFrom(trendProfile.normalizedTargets) ?? {};
    const onlineMockTargets = normalizedTargetDistributions(normalizedTargets.onlineMockExam);
    const rotationTopics = rotationTopicsFromSessionSummary(profile.sessionSummary, 12);
    const sourceContributions = sourceContributionsFromSessionSummary(profile.sessionSummary, 12);
    const seriesKey = `series-${profile.id}`;
    const seriesDistributions = profileDistributions(profileLike, profile.sampleSize);
    const stableTopics = distributionFromWeightedList(
      trendSignals.stableTopics,
      Array.isArray(profile.sourceDocumentIds) ? profile.sourceDocumentIds.length : 0,
      {},
      12
    );
    const notes = [
      profile.confidence === 'low' ? '趋势画像置信度低，建议继续导入连续月份源卷。' : '',
      stableTopics.length === 0 ? '未形成稳定高频知识点，当前趋势只可作为弱参考。' : ''
    ].filter(Boolean);
    return (
      <div key={profile.id}>
        <strong>连续趋势画像 #{profile.id}{activeSeriesProfile?.id === profile.id ? ' · 当前' : ''}</strong>
        <span>{profile.title} · {profile.status} · 样本 {profile.sampleSize} · 置信度 {profile.confidence}</span>
        <span>源卷 {profile.sourceDocumentIds.length} 份 · 单卷画像 {profile.sourceStyleProfileIds.length} 个</span>
        <AdminActionBar>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setExpandedProfileKey(expandedProfileKey === seriesKey ? null : seriesKey)}
          >
            {expandedProfileKey === seriesKey ? '收起趋势图表' : '查看趋势图表'}
          </button>
          {!options.archived && profile.status !== 'active' && (
            <button
              type="button"
              className={isExamSeriesProfileActivateBusy(profile.id) ? 'ghost-button admin-action-loading' : 'ghost-button'}
              onClick={() => onActivateExamSeriesProfile(profile.id)}
              disabled={isExamSeriesProfileActivateBusy(profile.id)}
            >
              {isExamSeriesProfileActivateBusy(profile.id) ? '激活中' : '设为当前趋势'}
            </button>
          )}
        </AdminActionBar>
        {expandedProfileKey === seriesKey && (
          <ProfileEvidencePanel
            title="连续趋势画像图表"
            metrics={[
              { label: '来源源卷', value: profile.sourceDocumentIds.length },
              { label: '样本题', value: profile.sampleSize },
              { label: '置信度', value: profile.confidence },
              { label: '稳定主题', value: stableTopics.length },
              { label: '轮换主题', value: rotationTopics.length },
              { label: '状态', value: profile.status }
            ]}
            notes={notes}
            distributions={[
              { title: '源卷贡献（按样本题数）', items: sourceContributions },
              { title: '稳定高频知识点', items: stableTopics },
              { title: '轮换知识点', items: rotationTopics },
              { title: '样本统计：难度趋势（样本占比）', items: seriesDistributions.difficulty },
              { title: '48题目标：难度配额（归一化）', items: onlineMockTargets.difficulty },
              { title: '样本统计：题型趋势（样本占比）', items: seriesDistributions.questionForm },
              { title: '48题目标：题型配额（归一化）', items: onlineMockTargets.questionForm },
              { title: '样本统计：答案趋势（样本占比）', items: seriesDistributions.answer },
              { title: '48题目标：答案配额（归一化）', items: onlineMockTargets.answer },
              { title: '样本统计：认知技能趋势（样本占比）', items: seriesDistributions.cognitiveSkill },
              { title: '样本统计：阅读负荷趋势（样本占比）', items: seriesDistributions.readingLoad },
              { title: '样本统计：计算负荷趋势（样本占比）', items: seriesDistributions.calculationLoad }
            ]}
          />
        )}
      </div>
    );
  }
  return (
    <AdminPanel>
      <AdminPanelHeader kicker="画像状态" title={`${generationProfiles.length} 个当前出题画像`}>
        <p>单卷画像是基础样本；连续趋势画像汇总多份源卷；当前出题画像才是科目训练和在线模考 AI 出题的推荐入口。</p>
      </AdminPanelHeader>
      <div className="metric-grid four">
        <div><span>单卷画像</span><strong>{styleProfiles.length}</strong></div>
        <div><span>趋势画像</span><strong>{examSeriesProfiles.length}</strong></div>
        <div><span>科目出题</span><strong>{activeSubjectPracticeProfile ? '已就绪' : '未生成'}</strong></div>
        <div><span>模考出题</span><strong>{activeMockExamProfile ? '已就绪' : '未生成'}</strong></div>
      </div>
      <AdminActionBar>
        <button
          type="button"
          className={isExamSeriesProfileBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
          onClick={onGenerateExamSeriesProfile}
          disabled={isExamSeriesProfileBusy || approvedQuestionCount <= 0}
          title={approvedQuestionCount > 0 ? '用当前自动纳入样本生成连续月份/多源卷趋势画像' : '需要先有自动纳入画像的源题样本'}
        >
          {isExamSeriesProfileBusy ? '趋势生成中' : '生成连续趋势画像'}
        </button>
        <button
          type="button"
          className={isGenerationProfileBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
          onClick={onGenerateGenerationProfiles}
          disabled={isGenerationProfileBusy || (styleProfiles.length === 0 && examSeriesProfiles.length === 0)}
          title="为科目训练和在线模考分别生成当前出题画像"
        >
          {isGenerationProfileBusy ? '出题画像生成中' : '生成当前出题画像'}
        </button>
        <button
          type="button"
          className={isQuestionVersionGovernanceBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
          onClick={onRefreshQuestionVersionGovernance}
          disabled={isQuestionVersionGovernanceBusy || generationProfiles.length === 0}
          title="按当前出题画像重算已生成 AI 题的版本状态"
        >
          {isQuestionVersionGovernanceBusy ? '治理运行中' : '运行版本治理'}
        </button>
      </AdminActionBar>
      <div className="admin-list compact">
        {examSeriesProfiles.length === 0 ? (
          <p className="form-hint">暂无连续趋势画像。多份源卷都完成自动纳入后，可生成趋势画像。</p>
        ) : visibleExamSeriesProfiles.map((profile) => renderExamSeriesProfile(profile))}
        {archivedExamSeriesProfiles.length > 0 && (
          <details className="admin-source-question-maintenance">
            <summary>历史趋势画像 {archivedExamSeriesProfiles.length}</summary>
            <p className="form-hint">已归档画像只用于回溯和排查，不参与当前自动出题。</p>
            {archivedExamSeriesProfiles.map((profile) => renderExamSeriesProfile(profile, { archived: true }))}
          </details>
        )}
        {generationProfiles.length === 0 && <p className="form-hint">暂无当前出题画像；自动出题会暂停，需先生成科目训练和在线模考的当前出题画像。</p>}
        {generationProfiles.map((profile) => {
          const generationKey = `generation-${profile.id}`;
          const profileRecord = recordFrom(profile.profile) ?? {};
          const policyRecord = recordFrom(profile.targetPolicy) ?? {};
          const assemblyRecord = recordFrom(policyRecord.assembly) ?? {};
          const normalizedTarget = nullableRecordFrom(policyRecord.normalizedTarget)
            ?? nullableRecordFrom(profileRecord.normalizedTarget);
          const targetDistributions = normalizedTarget ? normalizedTargetDistributions(normalizedTarget) : null;
          const requiredApprovedCount = numberValue(assemblyRecord.requiredApprovedCount);
          const generationDistributions = targetDistributions ?? profileDistributions(profileRecord, profile.sampleSize);
          const notes = [
            profile.seriesProfileId ? '' : '当前出题画像未绑定连续趋势画像，自动出题会暂停；请重新生成当前出题画像。',
            profile.confidence === 'low' ? '出题画像置信度低，建议补充源卷样本后重生成。' : ''
          ].filter(Boolean);
          return (
            <div key={profile.id}>
              <strong>{profile.useCase === 'online_mock_exam' ? '在线模考' : '科目训练'}当前出题画像 #{profile.id}</strong>
              <span>{profile.title} · {profile.status} · 样本 {profile.sampleSize} · 置信度 {profile.confidence}</span>
              <span>趋势画像 #{profile.seriesProfileId ?? '-'} · 来源单卷画像 #{profile.sourceStyleProfileId ?? '-'}</span>
              <AdminActionBar>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setExpandedProfileKey(expandedProfileKey === generationKey ? null : generationKey)}
                >
                  {expandedProfileKey === generationKey ? '收起出题图表' : '查看出题图表'}
                </button>
                {profile.status !== 'active' && (
                  <button
                    type="button"
                    className={isGenerationProfileActivateBusy(profile.id) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                    onClick={() => onActivateGenerationProfile(profile.id)}
                    disabled={isGenerationProfileActivateBusy(profile.id)}
                  >
                    {isGenerationProfileActivateBusy(profile.id) ? '激活中' : '设为当前出题画像'}
                  </button>
                )}
              </AdminActionBar>
              {expandedProfileKey === generationKey && (
                <ProfileEvidencePanel
                  title="当前出题画像图表"
                  metrics={[
                    { label: '用途', value: profile.useCase === 'online_mock_exam' ? '在线模考' : '科目训练' },
                    { label: '趋势画像', value: profile.seriesProfileId ?? '-' },
                    { label: '整卷门槛', value: requiredApprovedCount > 0 ? requiredApprovedCount : '-' },
                    { label: '状态', value: profile.status }
                  ]}
                  notes={notes}
                  distributions={[
                    { title: '目标难度', items: generationDistributions.difficulty },
                    { title: '目标题型', items: generationDistributions.questionForm },
                    { title: '目标认知技能', items: generationDistributions.cognitiveSkill },
                    { title: '目标阅读负荷', items: generationDistributions.readingLoad },
                    { title: '目标计算负荷', items: generationDistributions.calculationLoad },
                    { title: '目标答案配额', items: generationDistributions.answer }
                  ]}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="admin-list compact">
        {styleProfiles.length === 0 && <p className="form-hint">暂无画像。导入 active 真题 JSON 后，系统会自动映射、筛选并生成画像。</p>}
        {styleProfiles.map((profile) => {
          const profileRecord = recordFrom(profile.profile);
          const difficultyDistribution = recordFrom(profileRecord.difficultyDistribution);
          const readingLoadDistribution = recordFrom(profileRecord.readingLoadDistribution);
          const calculationLoadDistribution = recordFrom(profileRecord.calculationLoadDistribution);
          const estimatedTimeSeconds = recordFrom(profileRecord.estimatedTimeSeconds);
          const difficulty = Object.keys(difficultyDistribution).length
            ? Object.entries(difficultyDistribution).slice(0, 3).map(([key, value]) => `${key} ${value}`).join(' / ')
            : '-';
          const readingLoad = Object.keys(readingLoadDistribution).length
            ? Object.entries(readingLoadDistribution).slice(0, 3).map(([key, value]) => `${key} ${value}`).join(' / ')
            : '-';
          const calculationLoad = Object.keys(calculationLoadDistribution).length
            ? Object.entries(calculationLoadDistribution).slice(0, 4).map(([key, value]) => `${key} ${value}`).join(' / ')
            : '-';
          const timing = estimatedTimeSeconds.p75 ? ` · p75 ${estimatedTimeSeconds.p75}s` : '';
          const profileBehindSamples = profile.sampleSize < approvedQuestionCount;
          return (
            <div key={profile.id}>
              <strong>{profile.scopeTitle || profile.subject} {profileBehindSamples ? '· 可重生成' : '· 当前'}</strong>
              <span>画像 #{profile.id} · 样本 {profile.sampleSize}/{approvedQuestionCount} · 置信度 {profile.confidence} · {profile.syllabusVersion}</span>
              <span>难度 {difficulty} · 阅读 {readingLoad} · 计算 {calculationLoad}{timing}</span>
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}
