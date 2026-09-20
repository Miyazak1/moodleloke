import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { MathContent } from '../MathContent';
import { useI18n } from '../../i18n/useI18n';
import {
  createAdaptivePracticeRound,
  createAdaptivePracticeSession,
  getAdaptivePracticeRoundReport,
  getMockExamReport,
  type AdaptiveRoundReport,
  type MockExamReport
} from '../../lib/api';
import type { AgentMockExamSettlement } from '../../lib/api-agent';
import { routes } from '../../lib/routes';
import '../../styles/agent-report.css';

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${remainder}s`;
}

function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'warn' }) {
  return <span className="agent-report-metric" data-tone={tone}><small>{label}</small><strong>{value}</strong></span>;
}

function ReportState({
  status,
  title,
  body,
  actionLabel,
  onAction
}: {
  status: 'loading' | 'error';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`agent-structured-report-state${status === 'error' ? ' is-error' : ''}`} role={status === 'error' ? 'alert' : 'status'}>
      <Icon name={status === 'error' ? 'lucide:circle-alert' : 'lucide:loader-circle'} />
      <span><strong>{title}</strong><small>{body}</small></span>
      {actionLabel && onAction ? <button type="button" onClick={onAction}><Icon name="lucide:refresh-cw" />{actionLabel}</button> : null}
    </div>
  );
}

export function AgentAdaptiveResultMessage({
  roundId,
  taskType,
  onNavigate,
  customActions
}: {
  roundId: number;
  taskType?: string;
  onNavigate: (path: string) => void;
  customActions?: ReactNode;
}) {
  const { locale, t } = useI18n();
  const [report, setReport] = useState<AdaptiveRoundReport | null>(null);
  const [error, setError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);
  const [isContinuing, setIsContinuing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const questionDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    void getAdaptivePracticeRoundReport(roundId, locale === 'zh-CN' ? 'zh' : locale)
      .then((result) => { if (active) setReport(result); })
      .catch(() => { if (active) setError(t('agent.report.loadFailed', '本轮结果暂时无法加载。')); });
    return () => { active = false; };
  }, [loadRevision, locale, roundId, t]);

  if (error) return <ReportState status="error" title={t('agent.report.loadFailedTitle', '学习结果还没有载入')} body={error} actionLabel={t('agent.report.retryLoad', '重试加载')} onAction={() => setLoadRevision((current) => current + 1)} />;
  if (!report) return <ReportState status="loading" title={t('agent.report.loading', '正在整理本轮学习结果')} body={t('agent.report.loadingBody', '完成后会在 Agent 动态中显示结果、学习证据和下一步。')} />;

  const summary = report.summary;
  const primaryWeakTopic = report.weakTopics[0]?.title
    ?? report.items.find((item) => !item.isCorrect)?.topicTitle
    ?? t('agent.report.noWeakTopic', '本轮知识点');
  const isStrong = summary.accuracy >= 80;
  const isDeveloping = summary.accuracy >= 60 && summary.accuracy < 80;
  const title = isStrong
    ? t('agent.report.strongTitle', '这一轮做得很稳。')
    : isDeveloping
      ? t('agent.report.developingTitle', '已经找到需要巩固的位置。')
      : t('agent.report.focusTitle', '先处理一个最关键的薄弱点。');
  const body = isStrong
    ? t('agent.report.strongBody', '正确率达到 {accuracy}%，下一轮可以继续扩大覆盖面。').replace('{accuracy}', String(summary.accuracy))
    : t('agent.report.focusBody', '你答对 {correct}/{total} 题，目前最值得优先复盘的是“{topic}”。')
      .replace('{correct}', String(summary.correctCount)).replace('{total}', String(summary.total)).replace('{topic}', primaryWeakTopic);
  const evidenceCount = Math.max(0, summary.total - summary.unansweredCount);
  const isDiagnostic = taskType === 'diagnostic';
  const wrongItems = report.items.filter((item) => !item.isCorrect);

  async function startNextRound() {
    if (isContinuing) return;
    setIsContinuing(true);
    setError('');
    try {
      const session = await createAdaptivePracticeSession({
        subject: report.session.subject,
        mode: 'practice',
        questionLanguage: report.session.questionLanguage
      });
      const next = await createAdaptivePracticeRound(session.id);
      onNavigate(`${routes.cscaSubjects}/${report.session.subject}/practice/rounds/${next.round.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('agent.report.continueFailed', '下一轮暂时无法开始。'));
    } finally {
      setIsContinuing(false);
    }
  }

  function openQuestionReview() {
    setQuestionsOpen(true);
    window.setTimeout(() => questionDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  return (
    <section className="agent-structured-report" aria-label={t('agent.workspace.chatReportAria', 'Agent 动态学习报告')}>
      <header className="agent-report-intro">
        <span className="agent-report-signal" data-tone={isStrong ? 'good' : isDeveloping ? 'steady' : 'focus'}><Icon name={isStrong ? 'lucide:badge-check' : 'lucide:target'} /></span>
        <div>
          <span className="agent-report-kicker">{isDiagnostic ? t('agent.report.diagnosticComplete', '诊断已完成') : t('agent.report.roundComplete', '本轮已完成')}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      </header>

      <div className="agent-report-object">
        <div className="agent-report-object-head">
          <div><span>{t('agent.workspace.chatReportTitle', '结果、学习证据与下一步')}</span><strong>{primaryWeakTopic}</strong></div>
          <b>{summary.accuracy}%</b>
        </div>
        <div className="agent-report-progress" aria-hidden="true"><i style={{ width: `${Math.max(3, summary.accuracy)}%` }} /></div>
        <div className="agent-report-metrics">
          <Metric label={t('agent.report.correct', '答对')} value={`${summary.correctCount}/${summary.total}`} tone={isStrong ? 'good' : undefined} />
          <Metric label={t('agent.report.duration', '本轮用时')} value={formatDuration(summary.totalSeconds)} />
          <Metric label={t('agent.report.answerEvidence', '作答证据')} value={`${evidenceCount} ${t('agent.report.items', '项')}`} />
        </div>

        <div className="agent-report-insight">
          <Icon name="lucide:sparkles" />
          <div><small>{t('agent.report.agentJudgement', 'Agent 判断')}</small><strong>{isStrong ? t('agent.report.nextBroaden', '保持当前节奏，下一轮继续验证稳定性。') : t('agent.report.nextRepair', '先复盘共同错因，再开始下一轮练习。')}</strong></div>
        </div>

        {customActions ?? (
          <div className="agent-report-actions">
            <button type="button" onClick={openQuestionReview}><Icon name="lucide:book-open-check" />{t('agent.report.reviewFirst', '先看错题')}</button>
            <button type="button" className="primary" disabled={isContinuing} onClick={() => void startNextRound()}><Icon name={isContinuing ? 'lucide:loader-circle' : 'lucide:play'} />{isContinuing ? t('agent.report.preparing', '正在准备') : t('agent.report.nextRound', '继续下一轮')}</button>
          </div>
        )}

        <div className="agent-report-disclosures">
          <details open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
            <summary><span><Icon name="lucide:scan-search" />{isDiagnostic ? t('agent.report.viewDiagnosticEvidence', '查看诊断依据') : t('agent.report.viewLearningEvidence', '查看学习依据')}</span><Icon name="lucide:chevron-down" /></summary>
            <div className="agent-report-detail-body">
              <section>
                <small>{t('agent.report.weakTopics', '优先关注')}</small>
                <div className="agent-report-tags">
                  {report.weakTopics.length ? report.weakTopics.slice(0, 5).map((topic) => <span key={topic.topicId}>{topic.title}</span>) : <span className="is-good">{t('agent.report.noObviousWeakness', '暂无明显薄弱点')}</span>}
                </div>
              </section>
              {report.diagnosticCoverage && <section>
                <small>{t('agent.report.coverage', '证据覆盖')}</small>
                <p>{(isDiagnostic
                  ? t('agent.report.diagnosticCoverageCopy', '已覆盖 {covered}/{total} 个诊断维度，仍有 {remaining} 个维度需要后续补充证据。')
                  : t('agent.report.learningCoverageCopy', '本轮覆盖 {covered}/{total} 个知识维度，仍有 {remaining} 个维度需要后续补充证据。'))
                  .replace('{covered}', String(report.diagnosticCoverage.coveredCount))
                  .replace('{total}', String(report.diagnosticCoverage.totalCount))
                  .replace('{remaining}', String(report.diagnosticCoverage.lowConfidenceCount))}</p>
              </section>}
              {report.remediationPlan?.triggered && <section>
                <small>{t('agent.report.repairPlan', '补救安排')}</small>
                <p>{report.remediationPlan.conceptCards[0]?.title ?? t('agent.report.repairCopy', '下一轮将优先安排同类变式题。')}</p>
              </section>}
            </div>
          </details>

          <details ref={questionDetailsRef} open={questionsOpen} onToggle={(event) => setQuestionsOpen(event.currentTarget.open)}>
            <summary><span><Icon name="lucide:list-checks" />{t('agent.report.viewQuestions', '查看题目明细')}<em>{wrongItems.length}</em></span><Icon name="lucide:chevron-down" /></summary>
            <div className="agent-report-question-list">
              {(wrongItems.length ? wrongItems : report.items).map((item) => (
                <article key={item.id}>
                  <span className={item.isCorrect ? 'is-correct' : 'is-wrong'}>{item.isCorrect ? <Icon name="lucide:check" /> : item.position ?? item.orderNumber}</span>
                  <div>
                    <strong><MathContent text={item.prompt} /></strong>
                    <small>{item.isUnanswered ? t('agent.report.unanswered', '未作答') : `${t('agent.report.yourAnswer', '你的答案')} ${item.selectedAnswer ?? '—'} · ${t('agent.report.correctAnswer', '正确答案')} ${item.correctAnswer}`}</small>
                    <p><MathContent text={item.explanation} /></p>
                  </div>
                </article>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

export function AgentMockExamResultMessage({
  attemptId,
  settlement,
  settlementStatus,
  isContinuing,
  onContinue,
  onRetrySettlement
}: {
  attemptId: number;
  settlement: AgentMockExamSettlement | null;
  settlementStatus: 'loading' | 'ready' | 'unavailable';
  isContinuing: boolean;
  onContinue: () => void;
  onRetrySettlement: () => void;
}) {
  const { locale, t } = useI18n();
  const [report, setReport] = useState<MockExamReport | null>(null);
  const [error, setError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    void getMockExamReport(String(attemptId), { locale })
      .then((result) => { if (active) setReport(result); })
      .catch(() => { if (active) setError(t('agent.mockExam.reportUnavailable', '模考结果暂时无法加载。')); });
    return () => { active = false; };
  }, [attemptId, loadRevision, locale, t]);

  if (error) return <ReportState status="error" title={t('agent.mockExam.reportUnavailableTitle', '模考结果还没有载入')} body={error} actionLabel={t('agent.report.retryLoad', '重试加载')} onAction={() => setLoadRevision((current) => current + 1)} />;
  if (!report) return <ReportState status="loading" title={t('agent.mockExam.loadingReport', '正在整理模考结果')} body={t('agent.mockExam.loadingReportBody', '成绩就绪后会在 Agent 动态中显示失分点、学习证据和下一步。')} />;

  const countedTotal = report.summary.correctCount + report.summary.wrongCount + report.summary.unansweredCount;
  const total = report.summary.total > 0 ? report.summary.total : countedTotal > 0 ? countedTotal : report.attempt.paper.questionCount;
  const startedMs = Date.parse(report.attempt.startedAt);
  const submittedMs = report.attempt.submittedAt ? Date.parse(report.attempt.submittedAt) : Number.NaN;
  const timestampSeconds = Number.isFinite(startedMs) && Number.isFinite(submittedMs)
    ? Math.max(0, Math.round((submittedMs - startedMs) / 1000))
    : 0;
  const totalSeconds = report.summary.totalSeconds > 0 ? report.summary.totalSeconds : timestampSeconds;
  const accuracy = total ? Math.round((report.summary.correctCount / total) * 100) : 0;
  const focus = settlement?.learningReview.focusTopics[0]?.title ?? report.knowledgeStats.slice().sort((a, b) => (b.wrong / Math.max(1, b.total)) - (a.wrong / Math.max(1, a.total)))[0]?.tag;
  const nextTask = settlement?.learningReview.nextDecision?.primaryTask;
  const wrongItems = report.items.filter((item) => !item.isCorrect);
  const nextDecisionCopy = nextTask
    ? `${nextTask.type === 'targeted_practice' ? t('agent.task.targetedPractice', '针对性练习') : t('agent.task.learning', '下一项学习任务')} · ${settlement?.learningReview.nextDecision?.reasonSummary ?? ''}`
    : settlementStatus === 'loading'
      ? t('agent.mockExam.nextSyncing', '正在把本次模考纳入学习历程；你现在可以先复盘错题。')
      : t('agent.mockExam.nextUnavailable', '成绩已记录；学习证据同步未完成，可重试同步或先复盘错题。');

  return (
    <section className="agent-structured-report" aria-label={t('agent.mockExam.chatReportAria', 'Agent 动态模考报告')}>
      <header className="agent-report-intro">
        <span className="agent-report-signal" data-tone={accuracy >= 80 ? 'good' : 'focus'}><Icon name="lucide:clipboard-check" /></span>
        <div>
          <span className="agent-report-kicker">{t('agent.mockExam.reportKicker', '模考已完成')}</span>
          <h3>{accuracy >= 80 ? t('agent.mockExam.strongSummary', '这套卷完成得比较稳定。') : t('agent.mockExam.focusSummary', '成绩已记录，先解决最集中的失分点。')}</h3>
          <p>{focus
            ? t('agent.mockExam.focusCopy', '本次得分 {score}，最值得优先复盘的是“{topic}”。').replace('{score}', String(report.summary.score)).replace('{topic}', focus)
            : t('agent.mockExam.generalCopy', '本次得分 {score}，可以从错题开始逐题复盘。').replace('{score}', String(report.summary.score))}</p>
        </div>
      </header>

      <div className="agent-report-object">
        <div className="agent-report-object-head"><div><span>{t('agent.mockExam.chatReportTitle', '模考结果与下一步建议')}</span><strong>{report.attempt.paper.title}</strong></div><b>{report.summary.score}<small>/100</small></b></div>
        <div className="agent-report-progress" aria-hidden="true"><i style={{ width: `${Math.max(3, report.summary.score)}%` }} /></div>
        <div className="agent-report-metrics">
          <Metric label={t('agent.mockExam.correct', '正确')} value={`${report.summary.correctCount}/${total}`} tone={accuracy >= 80 ? 'good' : undefined} />
          <Metric label={t('agent.mockExam.wrong', '错误')} value={report.summary.wrongCount} tone={report.summary.wrongCount ? 'warn' : 'good'} />
          <Metric label={t('agent.mockExam.totalTime', '总用时')} value={formatDuration(totalSeconds)} />
        </div>

        <div className="agent-report-insight">
          <Icon name="lucide:route" />
          <div><small>{t('agent.mockExam.nextDecision', 'Agent 建议')}</small><strong>{nextDecisionCopy}</strong></div>
        </div>

        <div className="agent-report-actions">
          {wrongItems.length ? <details className="agent-report-action-menu">
            <summary><Icon name="lucide:list-checks" />{t('agent.report.reviewQuestions', '查看错题')}</summary>
            <div className="agent-report-question-list">
              {wrongItems.map((item) => <article key={item.id}><span className="is-wrong">{item.orderNumber}</span><div><strong><MathContent text={item.prompt} /></strong><small>{item.isUnanswered ? t('agent.report.unanswered', '未作答') : `${item.selected} → ${item.correctAnswer}`}</small><p><MathContent text={item.explanation} /></p></div></article>)}
            </div>
          </details> : <span className="agent-report-detail-unavailable"><Icon name="lucide:info" />{t('agent.mockExam.questionDetailsUnavailable', '本次仅保留了汇总成绩，逐题明细暂不可用。')}</span>}
          {settlementStatus === 'unavailable' ? <button type="button" onClick={onRetrySettlement}><Icon name="lucide:refresh-cw" />{t('agent.mockExam.retrySettlement', '重试同步')}</button> : null}
          {nextTask && <button type="button" className="primary" disabled={isContinuing} onClick={onContinue}><Icon name={isContinuing ? 'lucide:loader-circle' : 'lucide:arrow-right'} />{isContinuing ? t('agent.mockExam.materializing', '正在生成') : t('agent.mockExam.continue', '开始建议任务')}</button>}
        </div>

        <details className="agent-report-evidence-row">
          <summary><span><Icon name="lucide:database" />{t('agent.report.viewEvidence', '查看学习证据')}</span><Icon name="lucide:chevron-down" /></summary>
          <div className="agent-report-detail-body">
            <section><small>{t('agent.mockExam.focusTopics', '优先复盘')}</small><div className="agent-report-tags">{report.knowledgeStats.slice(0, 5).map((item) => <span key={item.tag}>{item.tag} · {item.wrong}/{item.total}</span>)}</div></section>
            <section><small>{t('agent.mockExam.evidenceUpdated', '学习证据')}</small><p>{settlement
              ? t('agent.mockExam.evidenceAccepted', '本次已接收 {count} 条可信答题证据').replace('{count}', String(settlement.learningReview.evidence.acceptedCount))
              : settlementStatus === 'loading'
                ? t('agent.mockExam.syncingBody', '系统正在接收本次模考证据。')
                : t('agent.mockExam.syncUnavailableBody', '成绩已经保留，但本次学习证据尚未同步；可返回报告重试。')}</p></section>
          </div>
        </details>
      </div>
    </section>
  );
}
