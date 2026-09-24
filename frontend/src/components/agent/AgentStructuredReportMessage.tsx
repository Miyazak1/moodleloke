import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { MathContent } from '../MathContent';
import { useI18n } from '../../i18n/useI18n';
import { AgentAsyncState } from './AgentAsyncState';
import {
  createAdaptivePracticeRound,
  createAdaptivePracticeSession,
  getAdaptivePracticeRoundReport,
  getMockExamReport,
  type AdaptiveRoundReport,
  type MockExamReport
} from '../../lib/api';
import { settleAgentPractice, type AgentMockExamSettlement, type AgentTaskSettlement } from '../../lib/api-agent';
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
  return <AgentAsyncState kind={status} title={title} body={body} actionLabel={actionLabel} onAction={onAction} />;
}

export function AgentAdaptiveResultMessage({
  roundId,
  taskType,
  onNavigate,
  customActions,
  renderFollowUp,
  onReportLoaded,
  onStartTargeted,
  onContinue,
  onOpenPlan,
  onOpenWeakness,
  onSettlementLoaded
}: {
  roundId: number;
  taskType?: string;
  onNavigate: (path: string) => void;
  customActions?: ReactNode;
  renderFollowUp?: (report: AdaptiveRoundReport) => ReactNode;
  onReportLoaded?: (report: AdaptiveRoundReport | null) => void;
  onStartTargeted?: (selection: { subject: 'math' | 'physics' | 'chemistry'; questionCount: number; focusTopicId?: number; reviewItemId?: number; patternType?: string }) => void;
  onContinue?: () => void;
  onOpenPlan?: () => void;
  onOpenWeakness?: () => void;
  onSettlementLoaded?: (settlement: AgentTaskSettlement) => void;
}) {
  const { locale, t } = useI18n();
  const [report, setReport] = useState<AdaptiveRoundReport | null>(null);
  const [error, setError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);
  const [isContinuing, setIsContinuing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [settlement, setSettlement] = useState<AgentTaskSettlement | null>(null);
  const [settlementError, setSettlementError] = useState('');
  const [settlementRevision, setSettlementRevision] = useState(0);
  const questionDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const onSettlementLoadedRef = useRef(onSettlementLoaded);

  useEffect(() => {
    onSettlementLoadedRef.current = onSettlementLoaded;
  }, [onSettlementLoaded]);

  useEffect(() => {
    let active = true;
    setReport(null);
    onReportLoaded?.(null);
    setError('');
    void getAdaptivePracticeRoundReport(roundId, locale === 'zh-CN' ? 'zh' : locale)
      .then((result) => {
        if (!active) return;
        setReport(result);
        onReportLoaded?.(result);
      })
      .catch(() => { if (active) setError(t('agent.report.loadFailed', '本轮结果暂时无法加载。')); });
    return () => { active = false; };
  }, [loadRevision, locale, onReportLoaded, roundId, t]);

  useEffect(() => {
    let active = true;
    setSettlement(null);
    setSettlementError('');
    void settleAgentPractice(roundId)
      .then((result) => {
        if (!active) return;
        setSettlement(result);
        onSettlementLoadedRef.current?.(result);
      })
      .catch((nextError) => {
        if (active) setSettlementError(nextError instanceof Error ? nextError.message : t('agent.report.settlementFailed', '验证结论暂时无法同步。'));
      });
    return () => { active = false; };
  }, [roundId, settlementRevision, t]);

  if (error) return <ReportState status="error" title={t('agent.report.loadFailedTitle', '学习结果还没有载入')} body={error} actionLabel={t('agent.report.retryLoad', '重试加载')} onAction={() => setLoadRevision((current) => current + 1)} />;
  if (!report) return <ReportState status="loading" title={t('agent.report.loading', '正在整理本轮学习结果')} body={t('agent.report.loadingBody', '完成后会在学习工作台显示结果、学习证据和下一步。')} />;

  const summary = report.summary;
  const decision = report.learningDecision;
  const primaryWeakTopic = report.weakTopics[0]?.title
    ?? report.items.find((item) => !item.isCorrect)?.topicTitle
    ?? t('agent.report.noWeakTopic', '本轮知识点');
  const isStrong = summary.accuracy >= 80;
  const isDeveloping = summary.accuracy >= 60 && summary.accuracy < 80;
  const title = decision?.headline ?? t('agent.report.pendingDecisionTitle', '本轮作答已记录。');
  const body = decision?.explanation ?? t('agent.report.pendingDecisionBody', '掌握判断暂未同步；当前只展示本轮结果，待学习证据同步后再决定下一步。');
  const evidenceCount = Math.max(0, summary.total - summary.unansweredCount);
  const isDiagnostic = taskType === 'diagnostic';
  const wrongItems = report.items.filter((item) => !item.isCorrect);
  const roundMode = report.round.plannerSnapshot && typeof report.round.plannerSnapshot === 'object' && !Array.isArray(report.round.plannerSnapshot)
    ? (report.round.plannerSnapshot as { mode?: unknown }).mode
    : null;
  const isVerification = settlement?.verification === true || roundMode === 'verification';
  const verificationResult = settlement?.verificationResult;
  const verificationTitle = !verificationResult
    ? '正在确认验证结论'
    : verificationResult.verdict === 'repaired'
      ? '该薄弱点已修复'
      : verificationResult.verdict === 'insufficient_evidence'
        ? '本轮证据不足'
        : verificationResult.currentRoundPassed
          ? '本轮通过，仍需间隔验证'
          : '该薄弱点仍需巩固';
  const verificationBody = !verificationResult
    ? '系统正在核对当前错因、独立作答和复习记录。'
    : verificationResult.verdict === 'repaired'
      ? `已连续通过 ${verificationResult.consecutivePassCount}/${verificationResult.requiredPassCount} 次独立验证，已从待复习队列移除。`
      : verificationResult.verdict === 'insufficient_evidence'
        ? `本轮只形成 ${settlement?.targetTotal ?? 0} 道有效验证题，不足以判定是否修复。`
        : verificationResult.currentRoundPassed
          ? `当前通过 ${verificationResult.consecutivePassCount}/${verificationResult.requiredPassCount} 次。为避免短时记忆造成假掌握，下一次验证需在间隔后完成。`
          : `本轮目标题正确率 ${settlement?.targetAccuracy ?? summary.accuracy}%，连续通过计数已重置。先回看原错因，再进行下一轮定向训练。`;

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

  function runDecisionAction() {
    const next = decision?.nextStep;
    if (!next || next.type === 'continue_practice' || next.type === 'broaden_coverage') {
      if (onContinue) onContinue();
      else void startNextRound();
      return;
    }
    if (next.type === 'delayed_verification') return;
    if (onStartTargeted) {
      onStartTargeted({
        subject: next.subject,
        questionCount: next.questionCount,
        ...(next.topicId ? { focusTopicId: next.topicId } : {}),
        ...(next.reviewItemId && next.patternType ? { reviewItemId: next.reviewItemId, patternType: next.patternType } : {})
      });
      return;
    }
    void startNextRound();
  }

  return (
    <section className="agent-structured-report" aria-label={t('agent.workspace.chatReportAria', '本轮学习报告')}>
      <header className="agent-report-intro">
        <span className="agent-report-signal" data-tone={isStrong ? 'good' : isDeveloping ? 'steady' : 'focus'}><Icon name={isStrong ? 'lucide:badge-check' : 'lucide:target'} /></span>
        <div>
          <span className="agent-report-kicker">{isDiagnostic ? t('agent.report.diagnosticComplete', '诊断已完成') : t('agent.report.roundComplete', '本轮已完成')}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      </header>

      <div className="agent-report-object">
        {isVerification ? <section className="agent-verification-result" data-verdict={verificationResult?.verdict ?? 'pending'}>
          <Icon name={verificationResult?.verdict === 'repaired' ? 'lucide:badge-check' : verificationResult?.verdict === 'insufficient_evidence' ? 'lucide:circle-help' : verificationResult?.currentRoundPassed ? 'lucide:calendar-clock' : 'lucide:refresh-cw'} />
          <div><small>独立验证结果</small><strong>{verificationTitle}</strong><p>{verificationBody}</p>{verificationResult?.nextReviewAt && verificationResult.nextAction === 'wait_for_spaced_verification' ? <em>下次验证：{new Date(verificationResult.nextReviewAt).toLocaleDateString(locale)}</em> : null}</div>
          {settlementError ? <button type="button" onClick={() => setSettlementRevision((current) => current + 1)}><Icon name="lucide:refresh-cw" />重试同步</button> : onOpenWeakness && verificationResult ? <button type="button" onClick={onOpenWeakness}><Icon name="lucide:arrow-left" />{verificationResult.verdict === 'repaired' ? '查看更新后的薄弱点' : '返回错题复盘'}</button> : null}
          {settlementError ? <p role="alert">{settlementError}</p> : null}
        </section> : null}
        <div className="agent-report-object-head">
          <div><span>{t('agent.workspace.chatReportTitle', '结果、学习证据与下一步')}</span><strong>{primaryWeakTopic}</strong></div>
          <b>{summary.accuracy}%</b>
        </div>
        <div className="agent-report-progress" aria-hidden="true"><i style={{ width: `${Math.max(3, summary.accuracy)}%` }} /></div>
        <div className="agent-report-metrics">
          <Metric label={t('agent.report.correct', '答对')} value={`${summary.correctCount}/${summary.total}`} tone={isStrong ? 'good' : undefined} />
          <Metric label={t('agent.report.duration', '本轮用时')} value={formatDuration(summary.totalSeconds)} />
          <Metric label={decision ? '独立答对' : t('agent.report.answerEvidence', '作答证据')} value={decision ? `${decision.evidenceBasis.independentCorrectCount}/${evidenceCount}` : `${evidenceCount} ${t('agent.report.items', '项')}`} />
        </div>

        <div className="agent-report-insight">
          <Icon name="lucide:scale" />
          <div><small>{decision ? '规则判断 · 来自真实作答证据' : '掌握判断暂未形成'}</small><strong>{decision?.nextStep.reason ?? '你仍可查看本轮题目，但系统不会仅凭正确率宣布已经掌握。'}</strong></div>
        </div>

        {customActions ?? (isVerification ? (
          <div className="agent-report-actions">
            {wrongItems.length ? <button type="button" onClick={openQuestionReview}><Icon name="lucide:book-open-check" />{t('agent.report.reviewFirst', '先看错题')}</button> : null}
            {verificationResult?.verdict === 'repaired' && onContinue ? <button type="button" className="primary" onClick={onContinue}><Icon name="lucide:arrow-right" />继续扩大知识覆盖</button> : null}
            {onOpenWeakness ? <button type="button" className={verificationResult?.verdict === 'repaired' ? '' : 'primary'} onClick={onOpenWeakness}><Icon name="lucide:history" />{verificationResult?.verdict === 'repaired' ? '查看薄弱点' : '回到错题与薄弱点'}</button> : null}
          </div>
        ) : (
          <div className="agent-report-actions">
            {wrongItems.length ? <button type="button" onClick={openQuestionReview}><Icon name="lucide:book-open-check" />{t('agent.report.reviewFirst', '先看错题')}</button> : null}
            <button type="button" className="primary" disabled={isContinuing || decision?.nextStep.type === 'delayed_verification'} onClick={runDecisionAction}><Icon name={isContinuing ? 'lucide:loader-circle' : decision?.nextStep.type === 'delayed_verification' ? 'lucide:calendar-clock' : 'lucide:play'} />{isContinuing ? t('agent.report.preparing', '正在准备') : decision?.nextStep.label ?? t('agent.report.nextRound', '继续下一轮')}</button>
            {onContinue && (decision?.nextStep.type === 'review_mistakes' || decision?.nextStep.type === 'targeted_practice') ? <button type="button" disabled={isContinuing} onClick={onContinue}><Icon name="lucide:arrow-right" />继续下一批</button> : null}
            {onOpenPlan ? <button type="button" onClick={onOpenPlan}><Icon name="lucide:calendar-range" />查看学习计划</button> : null}
          </div>
        ))}

        {renderFollowUp ? <div className="agent-report-follow-up">{renderFollowUp(report)}</div> : null}

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
              {decision && <section>
                <small>掌握判断依据</small>
                <p>首次作答 {decision.evidenceBasis.firstAttemptCount} 项 · 独立答对 {decision.evidenceBasis.independentCorrectCount} 项 · 提示后答对 {decision.evidenceBasis.assistedCorrectCount} 项{decision.evidenceBasis.averageSeconds !== null ? ` · 平均 ${decision.evidenceBasis.averageSeconds} 秒` : ''}</p>
                <div className="agent-report-tags">{decision.topics.slice(0, 5).map((topic) => <span key={topic.topicId}>{topic.title} · {topic.status === 'verified_mastery' ? '稳定掌握' : topic.status === 'needs_review' ? '需要复习' : topic.status === 'needs_verification' ? '等待验证' : '积累证据'}</span>)}</div>
                <p>{decision.adaptationPending ? '最新证据已保存，知识状态正在异步更新；当前建议已优先采用本轮作答。' : '知识状态已同步。AI 不直接修改掌握度。'}</p>
              </section>}
            </div>
          </details>

          <details ref={questionDetailsRef} open={questionsOpen} onToggle={(event) => setQuestionsOpen(event.currentTarget.open)}>
            <summary><span><Icon name="lucide:list-checks" />{t('agent.report.viewQuestions', '查看题目明细')}<em>{report.items.length}</em></span><Icon name="lucide:chevron-down" /></summary>
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
  if (!report) return <ReportState status="loading" title={t('agent.mockExam.loadingReport', '正在整理模考结果')} body={t('agent.mockExam.loadingReportBody', '成绩就绪后会在学习工作台显示失分点、学习证据和下一步。')} />;

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
  const localizedDecisionReason = locale.toLowerCase().startsWith('zh')
    ? focus
      ? `根据本次模考结果，建议先巩固“${focus}”，再用新题验证。`
      : '根据本次模考结果，建议先完成一项针对性巩固任务。'
    : settlement?.learningReview.nextDecision?.reasonSummary ?? '';
  const nextDecisionCopy = nextTask
    ? `${nextTask.type === 'targeted_practice' ? t('agent.task.targetedPractice', '针对性练习') : t('agent.task.learning', '下一项学习任务')} · ${localizedDecisionReason}`
    : settlementStatus === 'loading'
      ? t('agent.mockExam.nextSyncing', '正在把本次模考纳入学习历程；你现在可以先复盘错题。')
      : t('agent.mockExam.nextUnavailable', '成绩已记录；学习证据同步未完成，可重试同步或先复盘错题。');

  return (
    <section className="agent-structured-report" aria-label={t('agent.mockExam.chatReportAria', '模考学习报告')}>
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
