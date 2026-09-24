import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/useI18n';
import type { AgentJourneyOverview } from '../../lib/api-agent';
import { completeMyCscaWrongQuestionReview, getMyCscaWrongQuestions } from '../../lib/api-me';
import type { CscaWrongQuestionItem, CscaWrongQuestionResponse } from '../../lib/api-types';
import { Icon } from '../Icon';
import { MathContent } from '../MathContent';

export type WeaknessPracticeSelection = {
  subject: 'math' | 'physics' | 'chemistry';
  questionCount: number;
  focusTopicId?: number;
  reviewItemId?: number;
  patternType?: string;
};

type WeaknessEvidenceFilter = {
  key: string;
  label: string;
  subject?: string;
  topicId?: number;
  topicTitle?: string;
  patternType?: string;
  reviewItemId?: number;
};

function subjectLabel(value: unknown, t: (key: string, fallback?: string) => string) {
  if (value === 'math') return t('agent.subject.math', '数学');
  if (value === 'physics') return t('agent.subject.physics', '物理');
  if (value === 'chemistry') return t('agent.subject.chemistry', '化学');
  return t('agent.subject.general', '综合');
}

function answerText(item: CscaWrongQuestionItem, answer: string) {
  const option = item.options.find((candidate) => candidate.id === answer);
  return option ? `${answer}. ${option.text}` : answer || '未作答';
}

export function AgentWeaknessWorkspace({ overview, loading, error, onGoPractice, onStartPractice, onRetry }: {
  overview: AgentJourneyOverview | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onGoPractice: () => void;
  onStartPractice: (selection: WeaknessPracticeSelection) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [wrongQuestions, setWrongQuestions] = useState<CscaWrongQuestionResponse | null>(null);
  const [wrongQuestionsLoading, setWrongQuestionsLoading] = useState(true);
  const [wrongQuestionsError, setWrongQuestionsError] = useState('');
  const [wrongQuestionsRevision, setWrongQuestionsRevision] = useState(0);
  const [evidenceFilter, setEvidenceFilter] = useState<WeaknessEvidenceFilter | null>(null);
  const [expandedQuestionKey, setExpandedQuestionKey] = useState<string | null>(null);
  const [startingQuestionKey, setStartingQuestionKey] = useState<string | null>(null);
  const [questionActionError, setQuestionActionError] = useState<Record<string, string>>({});
  const [preparedReviews, setPreparedReviews] = useState<Record<string, { id: number; patternType: string }>>({});
  const topics = (overview?.weaknesses?.subjects ?? [])
    .flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subject: subject.subject })))
    .sort((left, right) => left.score - right.score || left.confidence - right.confidence)
    .slice(0, 8);
  const reviewQueue = useMemo(() => {
    const byTarget = new Map<string, NonNullable<AgentJourneyOverview['weaknesses']>['reviewQueue'][number]>();
    for (const item of overview?.weaknesses?.reviewQueue ?? []) {
      const key = item.topicId ? `${item.subject}:topic:${item.topicId}` : `${item.subject}:general:${item.patternType}`;
      const current = byTarget.get(key);
      if (!current || item.recurrenceCount > current.recurrenceCount || (item.recurrenceCount === current.recurrenceCount && item.priority > current.priority)) byTarget.set(key, item);
    }
    return [...byTarget.values()];
  }, [overview?.weaknesses?.reviewQueue]);

  useEffect(() => {
    let current = true;
    setWrongQuestionsLoading(true);
    setWrongQuestionsError('');
    void getMyCscaWrongQuestions()
      .then((result) => { if (current) setWrongQuestions(result); })
      .catch((loadError) => {
        if (!current) return;
        setWrongQuestions(null);
        setWrongQuestionsError(loadError instanceof Error ? loadError.message : '错题证据暂时无法读取。');
      })
      .finally(() => { if (current) setWrongQuestionsLoading(false); });
    return () => { current = false; };
  }, [wrongQuestionsRevision]);

  const visibleWrongQuestions = (wrongQuestions?.items ?? []).filter((item) => {
    if (!evidenceFilter) return true;
    if (evidenceFilter.subject && item.subject !== evidenceFilter.subject) return false;
    if (evidenceFilter.patternType && item.patternType !== evidenceFilter.patternType) return false;
    if (evidenceFilter.topicId && item.topicId !== evidenceFilter.topicId) return false;
    if (!evidenceFilter.topicId && evidenceFilter.topicTitle && item.topicTitle !== evidenceFilter.topicTitle) return false;
    return true;
  }).slice(0, 12);

  const startFromQuestion = async (item: CscaWrongQuestionItem) => {
    if (expandedQuestionKey !== item.itemKey || startingQuestionKey) return;
    setStartingQuestionKey(item.itemKey);
    setQuestionActionError((current) => ({ ...current, [item.itemKey]: '' }));
    try {
      let review = preparedReviews[item.itemKey]
        ?? (item.reviewPattern?.verificationStatus === 'pending_verification'
          ? { id: item.reviewPattern.id, patternType: item.reviewPattern.patternType }
          : null);
      if (!review) {
        const completed = await completeMyCscaWrongQuestionReview({
          subject: item.subject,
          topicId: item.topicId,
          patternType: item.patternType,
          questionId: item.questionId,
          sourceType: item.sourceType
        });
        review = { id: completed.id, patternType: item.patternType };
        setPreparedReviews((current) => ({ ...current, [item.itemKey]: review! }));
      }
      const started = await onStartPractice({
        subject: item.subject as 'math' | 'physics' | 'chemistry',
        questionCount: 3,
        ...(item.topicId ? { focusTopicId: item.topicId } : {}),
        reviewItemId: review.id,
        patternType: review.patternType
      });
      if (!started) setQuestionActionError((current) => ({ ...current, [item.itemKey]: '复盘记录已保存，但验证题暂时没有创建成功。可直接重试，薄弱点绑定不会丢失。' }));
    } catch (actionError) {
      setQuestionActionError((current) => ({ ...current, [item.itemKey]: actionError instanceof Error ? actionError.message : '暂时无法进入验证，请重试。' }));
    } finally {
      setStartingQuestionKey(null);
    }
  };

  return <>
    <section className="agent-context-intro">
      <span className="agent-kicker">{t('agent.journey.weaknessKicker', '真实学习证据')}</span>
      <h2>{t('agent.journey.weaknessTitle', '先处理最影响下一步的薄弱点')}</h2>
      <p>{t('agent.journey.weaknessBody', '这里只读取已投影的作答证据和复习队列，不根据聊天内容猜测掌握度。')}</p>
    </section>
    {loading ? <div className="agent-journey-loading"><Icon name="lucide:loader-circle" />{t('agent.journey.loadingWeakness', '正在读取学习证据')}</div> : error ? (
      <section className="agent-journey-empty"><Icon name="lucide:circle-alert" /><strong>{t('agent.journey.dataUnavailable', '暂时无法读取')}</strong><p>{error}</p><button type="button" onClick={onRetry}><Icon name="lucide:refresh-cw" />{t('agent.journey.retry', '重试读取')}</button></section>
    ) : topics.length || reviewQueue.length || wrongQuestionsLoading || Boolean(wrongQuestionsError) || Boolean(wrongQuestions?.items.length) ? <>
      <section className="agent-journey-topic-list" aria-label={t('agent.journey.weakTopics', '薄弱知识点')}>
        {topics.map((topic) => <button type="button" aria-label={`查看${subjectLabel(topic.subject, t)}薄弱点：${topic.title}`} className={evidenceFilter?.key === `topic:${topic.subject}:${topic.topicId}` ? 'active' : ''} key={`${topic.subject}-${topic.topicId}`} onClick={() => setEvidenceFilter({ key: `topic:${topic.subject}:${topic.topicId}`, label: topic.title, subject: topic.subject, topicId: topic.topicId, topicTitle: topic.title })}>
          <span data-subject={topic.subject}>{subjectLabel(topic.subject, t).slice(0, 1)}</span>
          <div><small>{subjectLabel(topic.subject, t)} · {topic.code}</small><strong>{topic.title}</strong><em>{topic.attemptCount} {t('agent.journey.attempts', '次作答')} · {Math.round(topic.score * 100)}%</em></div>
          <i style={{ '--agent-evidence-score': `${Math.max(4, Math.round(topic.score * 100))}%` } as CSSProperties} />
          <Icon name="lucide:chevron-right" />
        </button>)}
      </section>
      {reviewQueue.length ? <section className="agent-context-card agent-review-queue"><header><Icon name="lucide:refresh-cw" /><strong>{t('agent.journey.reviewQueue', '待复习')}</strong></header>{reviewQueue.slice(0, 5).map((item) => <button type="button" aria-label={`查看待复习项：${item.title}，${item.recurrenceCount}次重复错误`} className={evidenceFilter?.key === `review:${item.reviewItemId}` ? 'active' : ''} key={item.reviewItemId} onClick={() => setEvidenceFilter({ key: `review:${item.reviewItemId}`, label: item.title, subject: item.subject, topicId: item.topicId, topicTitle: item.title, patternType: item.patternType, reviewItemId: Number(item.reviewItemId) })}><b>{item.title}</b><span>{item.consecutiveVerificationPassCount ? `独立验证 ${item.consecutiveVerificationPassCount}/${item.requiredConsecutiveVerificationPassCount ?? 2} · ` : ''}{item.recurrenceCount} {t('agent.journey.recurrences', '次重复错误')}</span><Icon name="lucide:chevron-right" /></button>)}</section> : null}
      <section className="agent-wrong-evidence" aria-label="具体错题证据">
        <header><div><span className="agent-kicker">具体错题</span><strong>{evidenceFilter ? `正在查看：${evidenceFilter.label}` : '从错题中学习并验证'}</strong><small>先看当时为什么错，再做同类题验证是否真正掌握。</small></div>{evidenceFilter && <button type="button" onClick={() => setEvidenceFilter(null)}><Icon name="lucide:x" />查看全部</button>}</header>
        {wrongQuestionsLoading ? <div className="agent-journey-loading"><Icon name="lucide:loader-circle" />正在读取具体错题</div> : wrongQuestionsError ? <div className="agent-wrong-evidence-state"><Icon name="lucide:circle-alert" /><span>{wrongQuestionsError}</span><button type="button" onClick={() => setWrongQuestionsRevision((current) => current + 1)}>重试读取错题</button></div> : visibleWrongQuestions.length ? <div className="agent-wrong-question-list">
          {visibleWrongQuestions.map((item) => { const expanded = expandedQuestionKey === item.itemKey; const explanation = item.structuredExplanation; return <article key={item.itemKey} className={expanded ? 'expanded' : ''}>
            <header><div><small>{subjectLabel(item.subject, t)} · {item.topicTitle}</small><span>{item.patternLabel}</span></div><em>{item.status === 'mastered' ? '已掌握' : item.nextReviewAt ? '待复习' : '错题证据'}</em></header>
            <MathContent text={item.prompt} />
            <div className="agent-wrong-answer-comparison"><span>你的答案 <b>{answerText(item, item.selectedAnswer)}</b></span><span>正确答案 <b>{answerText(item, item.correctAnswer)}</b></span></div>
            {expanded && <div className="agent-wrong-question-learning"><div className="agent-wrong-options">{item.options.map((option) => <div key={option.id} className={option.id === item.correctAnswer ? 'correct' : option.id === item.selectedAnswer ? 'selected-wrong' : ''}><b>{option.id}</b><MathContent text={option.text} /></div>)}</div><dl><div><dt>为什么错</dt><dd><MathContent text={explanation?.whyWrong || item.explanation || '当前题目暂未提供详细错因。'} /></dd></div>{explanation?.correctApproach && <div><dt>正确思路</dt><dd><MathContent text={explanation.correctApproach} /></dd></div>}{explanation?.avoidNextTime && <div><dt>下次如何避免</dt><dd><MathContent text={explanation.avoidNextTime} /></dd></div>}</dl><div className="agent-wrong-completion-rule"><Icon name="lucide:badge-check" /><span><strong>本次完成标准</strong><small>先完成错因复盘，再独立完成 3 道同知识点新题；之后仍需连续独立验证，不能用一次答对代替掌握。</small></span></div></div>}
            {questionActionError[item.itemKey] && <p className="agent-wrong-action-error" role="alert">{questionActionError[item.itemKey]}</p>}
            <footer><button type="button" className="secondary" onClick={() => setExpandedQuestionKey(expanded ? null : item.itemKey)}><Icon name={expanded ? 'lucide:chevron-up' : 'lucide:book-open-check'} />{expanded ? '收起解析' : '查看解析并学习'}</button><button type="button" disabled={!expanded || startingQuestionKey !== null || item.status === 'mastered'} title={!expanded ? '请先查看错因和正确思路' : undefined} onClick={() => void startFromQuestion(item)}><Icon name={startingQuestionKey === item.itemKey ? 'lucide:loader-circle' : 'lucide:refresh-cw'} />{item.status === 'mastered' ? '已完成验证' : startingQuestionKey === item.itemKey ? '正在准备验证' : '已复盘，开始独立验证'}</button></footer>
          </article>; })}
        </div> : <div className="agent-wrong-evidence-state"><Icon name="lucide:search-x" /><span>{evidenceFilter ? '这个薄弱点还没有可回看的具体错题，可直接开始针对练习。' : '当前没有可回看的具体错题。'}</span>{evidenceFilter?.subject && <button type="button" onClick={() => onStartPractice({ subject: evidenceFilter.subject as 'math' | 'physics' | 'chemistry', questionCount: 3, ...(evidenceFilter.topicId ? { focusTopicId: evidenceFilter.topicId } : {}), ...(evidenceFilter.reviewItemId && evidenceFilter.patternType ? { reviewItemId: evidenceFilter.reviewItemId, patternType: evidenceFilter.patternType } : {}) })}>开始针对练习</button>}</div>}
      </section>
      <section className="agent-journey-action"><div><strong>完成一次“复盘—验证”闭环</strong><small>选择上面的薄弱点或错题，查看错因后做 3 道同类题；新结果会自动更新这里。</small></div><button type="button" onClick={onGoPractice}>自由做题<Icon name="lucide:arrow-right" /></button></section>
    </> : <section className="agent-journey-empty"><Icon name="lucide:scan-search" /><strong>{t('agent.journey.noWeakness', '还没有足够证据')}</strong><p>{t('agent.journey.noWeaknessBody', '完成诊断或练习后，薄弱知识点会出现在这里。')}</p><button type="button" onClick={onGoPractice}><Icon name="lucide:play" />{t('agent.journeyAction.startEvidence', '开始做题积累证据')}</button></section>}
  </>;
}
