import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { useI18n } from '../../i18n/useI18n';
import { API_BASE, downloadPastPaperFile, getPastPaper, type PastPaperDetail, type PastPaperFile } from '../../lib/api';
import {
  createAgentLearningContext,
  getAgentPastPaperAssistance,
  getAgentPastPaperProgress,
  getAgentPastPaperQuestionIndex,
  getAgentPastPaperReview,
  requestAgentPastPaperAssistance,
  startAgentPastPaperAttempt,
  submitAgentPastPaperAttempt,
  type AgentPastPaperAssistanceAction,
  type AgentPastPaperAssistanceAvailability,
  type AgentPastPaperAttemptResult,
  type AgentPastPaperProgress,
  type AgentPastPaperReview,
  type AgentPastPaperQuestionIndex
} from '../../lib/api-agent';

type AgentPastPaperWorkspaceProps = {
  slug: string;
  conversationId?: string;
  initialQuestionId?: number;
  onContextReady?: (conversationId: string) => void;
  onAsk: (prompt: string, context: { slug: string; questionId: number }) => void;
  onContinueLearning: () => void;
};

function fileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileUrl(file: PastPaperFile) {
  try {
    const url = new URL(file.fileUrl, API_BASE || window.location.origin);
    if (file.checksum) url.searchParams.set('v', file.checksum.slice(0, 16));
    return url.toString();
  } catch {
    return file.fileUrl;
  }
}

function elapsedLabel(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

const ASSISTANCE_LABELS: Record<AgentPastPaperAssistanceAction, { zh: string; en: string; icon: string }> = {
  clarify_question: { zh: '帮我读懂题目', en: 'Clarify the question', icon: 'lucide:list-tree' },
  recall_concept: { zh: '回忆相关概念', en: 'Recall the concept', icon: 'lucide:brain' },
  next_step_hint: { zh: '给我下一步提示', en: 'Give one hint', icon: 'lucide:route' },
  check_step: { zh: '检查我的思路', en: 'Check my step', icon: 'lucide:scan-check' },
  show_full_solution: { zh: '查看完整解析', en: 'Show full solution', icon: 'lucide:book-open-check' }
};

export function AgentPastPaperWorkspace({ slug, conversationId, initialQuestionId, onContextReady, onAsk, onContinueLearning }: AgentPastPaperWorkspaceProps) {
  const { locale, t } = useI18n();
  const [detail, setDetail] = useState<PastPaperDetail | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [busyFileId, setBusyFileId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [questionIndex, setQuestionIndex] = useState<AgentPastPaperQuestionIndex | null>(null);
  const [progress, setProgress] = useState<AgentPastPaperProgress | null>(null);
  const [review, setReview] = useState<AgentPastPaperReview | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(initialQuestionId ?? null);
  const [assistance, setAssistance] = useState<AgentPastPaperAssistanceAvailability | null>(null);
  const [assistanceBusy, setAssistanceBusy] = useState<AgentPastPaperAssistanceAction | null>(null);
  const [studentWork, setStudentWork] = useState('');
  const [solutionArmed, setSolutionArmed] = useState(false);
  const [attempt, setAttempt] = useState<AgentPastPaperAttemptResult | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [loadRevision, setLoadRevision] = useState(0);
  const [workspaceContextId, setWorkspaceContextId] = useState<string | undefined>(conversationId);
  const contextProvisioningRef = useRef<ReturnType<typeof createAgentLearningContext> | null>(null);

  useEffect(() => {
    setWorkspaceContextId(conversationId);
  }, [conversationId, slug]);

  useEffect(() => {
    let alive = true;
    if (workspaceContextId) return () => { alive = false; };
    const provisioning = contextProvisioningRef.current
      ?? createAgentLearningContext({ kind: 'past_paper', resourceId: slug });
    contextProvisioningRef.current = provisioning;
    void provisioning
      .then((context) => {
        if (!alive) return;
        setWorkspaceContextId(context.contextId);
        onContextReady?.(context.contextId);
      })
      .catch((nextError) => {
        if (alive) setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.contextFailed', '真题学习空间暂时无法建立。'));
      })
      .finally(() => {
        if (contextProvisioningRef.current === provisioning) contextProvisioningRef.current = null;
      });
    return () => { alive = false; };
  }, [onContextReady, t, workspaceContextId]);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError('');
    void Promise.all([
      getPastPaper(slug, { locale }),
      getAgentPastPaperQuestionIndex(slug)
    ])
      .then(([result, index]) => {
        if (!alive) return;
        setDetail(result);
        setQuestionIndex(index);
        const preferred = result.files.find((file) => file.kind === 'paper') ?? result.files[0];
        setSelectedFileId(preferred?.id ?? null);
        const preferredQuestion = index.questions.find((item) => item.id === initialQuestionId)
          ?? index.questions.find((item) => item.canAnswer)
          ?? index.questions[0];
        setSelectedQuestionId(preferredQuestion?.id ?? null);
      })
      .catch((nextError) => alive && setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.loadFailed', '真题暂时无法加载。')));
    return () => { alive = false; };
  }, [initialQuestionId, loadRevision, locale, slug, t]);

  useEffect(() => {
    let alive = true;
    setProgress(null);
    if (!workspaceContextId) return () => { alive = false; };
    void getAgentPastPaperProgress(slug, workspaceContextId)
      .then((sessionProgress) => {
        if (!alive) return;
        setProgress(sessionProgress);
        if (!initialQuestionId && sessionProgress.nextQuestionId) setSelectedQuestionId(sessionProgress.nextQuestionId);
      })
      .catch(async (nextError) => {
        if (!alive) return;
        const message = nextError instanceof Error ? nextError.message : '';
        if (/对话不存在|conversation(?:\s+is)?\s+not\s+found/i.test(message)) {
          try {
            const context = await createAgentLearningContext({ kind: 'past_paper', resourceId: slug });
            if (!alive) return;
            setWorkspaceContextId(context.contextId);
            onContextReady?.(context.contextId);
            return;
          } catch (contextError) {
            if (!alive) return;
            setError(contextError instanceof Error ? contextError.message : t('agent.pastPaper.contextFailed', '真题学习空间暂时无法建立。'));
            return;
          }
        }
        setError(message || t('agent.pastPaper.progressFailed', '真题进度暂时无法加载。'));
      });
    return () => { alive = false; };
  }, [initialQuestionId, onContextReady, slug, t, workspaceContextId]);

  useEffect(() => {
    let alive = true;
    setAssistance(null);
    setAttempt(null);
    setSelectedAnswer('');
    setSolutionArmed(false);
    if (!workspaceContextId || !selectedQuestionId || !questionIndex) return () => { alive = false; };
    const selectedSummary = questionIndex?.questions.find((question) => question.id === selectedQuestionId);
    if (selectedSummary && !selectedSummary.canAnswer) return () => { alive = false; };
    void startAgentPastPaperAttempt(slug, selectedQuestionId, { clientRequestId: crypto.randomUUID(), conversationId: workspaceContextId })
      .then(async (result) => {
        if (!alive) return;
        setAttempt(result);
        setSelectedAnswer(result.attempt.selectedAnswer ?? '');
        setAssistance(await getAgentPastPaperAssistance(slug, selectedQuestionId, workspaceContextId));
        if (alive) setProgress(await getAgentPastPaperProgress(slug, workspaceContextId));
      })
      .catch((nextError) => { if (alive) setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.assistanceLoadFailed', '学习辅助暂时无法加载。')); });
    return () => { alive = false; };
  }, [questionIndex, selectedQuestionId, slug, t, workspaceContextId]);

  useEffect(() => {
    let alive = true;
    setReview(null);
    setReviewError('');
    if (!workspaceContextId || progress?.status !== 'completed') return () => { alive = false; };
    void getAgentPastPaperReview(slug, workspaceContextId)
      .then((result) => { if (alive) setReview(result); })
      .catch((nextError) => { if (alive) setReviewError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.reviewFailed', '整卷复盘暂时无法加载。')); });
    return () => { alive = false; };
  }, [progress?.status, slug, t, workspaceContextId]);

  useEffect(() => {
    if (!attempt || attempt.attempt.status === 'submitted') return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.attempt.id, attempt?.attempt.status]);

  const selectedFile = useMemo(
    () => detail?.files.find((file) => file.id === selectedFileId) ?? null,
    [detail, selectedFileId]
  );
  const selectedQuestion = useMemo(
    () => questionIndex?.questions.find((question) => question.id === selectedQuestionId) ?? null,
    [questionIndex, selectedQuestionId]
  );
  const viewerUrl = selectedFile
    ? `${fileUrl(selectedFile)}${selectedFile.kind === 'paper' && selectedQuestion?.pageNumber ? `#page=${selectedQuestion.pageNumber}` : ''}`
    : '';

  async function download(file: PastPaperFile) {
    if (!detail || busyFileId) return;
    setBusyFileId(file.id);
    setError('');
    try {
      const result = await downloadPastPaperFile(detail.paper.slug, file.id);
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.downloadFailed', '下载失败，请稍后重试。'));
    } finally {
      setBusyFileId(null);
    }
  }

  async function requestAssistance(action: AgentPastPaperAssistanceAction, confirmed = false) {
    if (!workspaceContextId || !selectedQuestionId || assistanceBusy) return;
    setAssistanceBusy(action);
    setError('');
    try {
      await requestAgentPastPaperAssistance(slug, selectedQuestionId, {
        clientRequestId: crypto.randomUUID(),
        conversationId: workspaceContextId,
        action,
        ...(action === 'check_step' ? { studentWork } : {}),
        ...(confirmed ? { confirmed: true } : {}),
        language: locale.startsWith('en') ? 'en' : 'zh'
      });
      setAssistance(await getAgentPastPaperAssistance(slug, selectedQuestionId, workspaceContextId));
      if (action === 'show_full_solution') setSolutionArmed(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.assistanceFailed', '学习辅助生成失败。'));
    } finally {
      setAssistanceBusy(null);
    }
  }

  async function submitAnswer() {
    if (!workspaceContextId || !attempt || attempt.attempt.status === 'submitted' || !selectedAnswer.trim() || attemptBusy) return;
    setAttemptBusy(true);
    setError('');
    try {
      const result = await submitAgentPastPaperAttempt(attempt.attempt.id, { clientRequestId: crypto.randomUUID(), selectedAnswer });
      setAttempt(result);
      if (selectedQuestionId) setAssistance(await getAgentPastPaperAssistance(slug, selectedQuestionId, workspaceContextId));
      setProgress(await getAgentPastPaperProgress(slug, workspaceContextId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('agent.pastPaper.submitFailed', '答案提交失败。'));
    } finally {
      setAttemptBusy(false);
    }
  }

  if (error && !detail) return <div className="agent-past-paper-state is-error"><Icon name="lucide:circle-alert" /><strong>{error}</strong><button type="button" onClick={() => { setError(''); setLoadRevision((current) => current + 1); }}><Icon name="lucide:refresh-cw" />{t('agent.pastPaper.retryLoad', '重试加载')}</button></div>;
  if (!detail) return <div className="agent-past-paper-state"><Icon name="lucide:loader-circle" /><strong>{t('agent.pastPaper.loading', '正在载入真题工作区')}</strong></div>;

  const subject = detail.paper.subject === 'math' ? t('agent.subject.math', '数学')
    : detail.paper.subject === 'physics' ? t('agent.subject.physics', '物理')
      : t('agent.subject.chemistry', '化学');

  return (
    <div className="agent-past-paper-workspace">
      <aside className="agent-past-paper-files">
        <header>
          <span className="agent-kicker"><Icon name="lucide:library" />{t('agent.pastPaper.source', '已发布真题')}</span>
          <h2>{detail.paper.title}</h2>
          <p>{subject}{detail.paper.examYear ? ` · ${detail.paper.examYear}` : ''}{detail.paper.questionCount ? ` · ${detail.paper.questionCount} ${t('agent.verification.questions', '题')}` : ''}</p>
        </header>
        <div className="agent-past-paper-file-list">
          {detail.files.map((file) => (
            <button key={file.id} type="button" className={file.id === selectedFileId ? 'active' : ''} onClick={() => setSelectedFileId(file.id)}>
              <Icon name={file.kind === 'answers' || file.kind === 'solutions' ? 'lucide:book-open-check' : 'lucide:file-text'} />
              <span><strong>{file.label}</strong><small>{file.kind} {fileSize(file.fileSizeBytes) ? `· ${fileSize(file.fileSizeBytes)}` : ''}</small></span>
              <Icon name="lucide:chevron-right" />
            </button>
          ))}
        </div>
        {progress && progress.answerableQuestions > 0 ? <section className={`agent-past-paper-progress ${progress.status}`} aria-label={t('agent.pastPaper.progress', '作答进度')}>
          <div><span>{progress.status === 'completed' ? t('agent.pastPaper.completed', '本卷已完成') : t('agent.pastPaper.progress', '作答进度')}</span><strong>{progress.submittedCount}/{progress.answerableQuestions}</strong></div>
          <div className="agent-past-paper-progress-track"><i style={{ width: `${Math.round(progress.completionRate * 100)}%` }} /></div>
          <p><span><b>{progress.correctCount}</b>{t('agent.pastPaper.correctCount', '答对')}</span><span><b>{progress.incorrectCount}</b>{t('agent.pastPaper.incorrectCount', '待巩固')}</span><span><b>{elapsedLabel(progress.timeSpentSeconds)}</b>{t('agent.pastPaper.totalTime', '累计')}</span></p>
          {progress.status === 'completed' ? <small><Icon name="lucide:circle-check" />{t('agent.pastPaper.completionSummary', '作答结果已保存，Agent 可据此安排后续巩固。')}</small> : null}
        </section> : null}
        {review ? <section className="agent-past-paper-review" aria-label={t('agent.pastPaper.review', '整卷复盘')}>
          <div><span><Icon name="lucide:chart-no-axes-combined" />{t('agent.pastPaper.review', '整卷复盘')}</span><strong>{review.summary.accuracy}%</strong></div>
          <p>{review.focusTopics.length
            ? `${t('agent.pastPaper.focusTopics', '优先巩固')}：${review.focusTopics.map((item) => item.title).join('、')}`
            : t('agent.pastPaper.noFocusTopics', '本卷没有识别出明确的薄弱知识点。')}</p>
          {review.decision.primaryTask ? <small><Icon name="lucide:route" />{t('agent.pastPaper.nextRecommendation', '最新建议')}：{review.decision.primaryTask.subject} · {review.decision.primaryTask.type}{review.decision.estimatedMinutes ? ` · ${review.decision.estimatedMinutes} ${t('common.minutes', '分钟')}` : ''}</small>
            : <small><Icon name="lucide:info" />{review.decision.status === 'goal_unset' ? t('agent.pastPaper.goalRequired', '设置目标分数和考试日期后，Agent 才能生成下一方案。') : t('agent.pastPaper.decisionUpdating', '学习证据正在更新，稍后可生成下一方案。')}</small>}
          <button type="button" onClick={onContinueLearning}>
            <Icon name="lucide:arrow-left" />{t('agent.pastPaper.continueLearning', '返回做题')}<Icon name="lucide:arrow-right" />
          </button>
        </section> : reviewError ? <p className="agent-past-paper-review-error">{reviewError}</p> : null}
        <section className="agent-past-paper-question-index" aria-label={t('agent.pastPaper.questionIndex', '题目索引')}>
          <div><strong>{t('agent.pastPaper.questionIndex', '题目索引')}</strong><small>{questionIndex?.status === 'ready' ? `${questionIndex.questions.length} ${t('agent.verification.questions', '题')}` : t('agent.pastPaper.indexUnavailable', '尚未绑定可信索引')}</small></div>
          {questionIndex?.status === 'ready' ? <div className="agent-past-paper-question-grid">
            {questionIndex.questions.map((question) => (
              <button key={question.id} type="button" className={[
                question.id === selectedQuestionId ? 'active' : '',
                progress?.items.find((item) => item.questionId === question.id)?.status === 'in_progress' ? 'in-progress' : '',
                progress?.items.find((item) => item.questionId === question.id)?.outcome === 'correct' ? 'answered-correct' : '',
                progress?.items.find((item) => item.questionId === question.id)?.outcome === 'incorrect' ? 'answered-incorrect' : '',
                !question.canAnswer ? 'unavailable' : ''
              ].filter(Boolean).join(' ')} title={question.promptPreview ?? undefined} onClick={() => setSelectedQuestionId(question.id)}>
                {question.questionNumber}{question.pageNumber ? <small>P{question.pageNumber}</small> : null}
              </button>
            ))}
          </div> : <p>{t('agent.pastPaper.indexUnavailableBody', '管理员需要把这份 PDF 资料绑定到同科目的可信源卷；绑定前 Agent 不会猜测题目内容。')}</p>}
        </section>
        {selectedFile && <div className="agent-past-paper-actions">
          <button type="button" disabled={!selectedQuestion} onClick={() => selectedQuestion && onAsk(`${t('agent.pastPaper.analyzeQuestion', '请分析这道真题')}：${detail.paper.title} · ${t('agent.evidence.question', '题目')} ${selectedQuestion.questionNumber}`, { slug: detail.paper.slug, questionId: selectedQuestion.id })}>
            <Icon name="lucide:message-square-text" />{selectedQuestion ? `${t('agent.pastPaper.analyze', '分析第')} ${selectedQuestion.questionNumber} ${t('agent.verification.questions', '题')}` : t('agent.pastPaper.selectQuestion', '选择一道题进行分析')}
          </button>
          <button type="button" className="secondary" disabled={busyFileId === selectedFile.id} onClick={() => void download(selectedFile)}>
            <Icon name={busyFileId === selectedFile.id ? 'lucide:loader-circle' : 'lucide:download'} />{t('pastPapers.downloadFile', '免费下载')}
          </button>
        </div>}
        {error && <p className="agent-past-paper-error" role="alert">{error}</p>}
      </aside>
      <main className="agent-past-paper-viewer">
        {selectedFile ? <>
          <div className="agent-past-paper-viewer-head"><strong>{selectedFile.label}</strong><span>{t('agent.pastPaper.viewerHint', '可在阅读器中缩放、搜索和翻页')}</span></div>
          <div className="agent-past-paper-viewer-body">
            <iframe src={viewerUrl} title={`${detail.paper.title} · ${selectedFile.label}`} />
            <aside className="agent-past-paper-tutor">
              <header>
                <span><Icon name="lucide:sparkles" />{t('agent.pastPaper.tutor', '分层讲题')}</span>
                <strong>{selectedQuestion ? `${t('agent.evidence.question', '题目')} ${selectedQuestion.questionNumber}` : t('agent.pastPaper.selectQuestion', '先选择一道题')}</strong>
                <small>{t('agent.pastPaper.tutorPolicy', '先提示、后解析；使用辅助不会直接改变掌握度。')}</small>
              </header>
              {selectedQuestion && selectedQuestion.canAnswer ? <>
                {attempt ? <section className="agent-past-paper-answer" aria-label={t('agent.pastPaper.answerArea', '真题作答区')}>
                  <div className="agent-past-paper-answer-head">
                    <span>{t('agent.pastPaper.independentAttempt', '独立作答')}</span>
                    <small><Icon name="lucide:timer" />{attempt.attempt.status === 'submitted' && attempt.attempt.timeSpentSeconds !== null ? elapsedLabel(attempt.attempt.timeSpentSeconds) : elapsedLabel((clockNow - new Date(attempt.attempt.startedAt).getTime()) / 1000)}</small>
                  </div>
                  <p>{attempt.question.prompt}</p>
                  {attempt.question.options.length ? <div className="agent-past-paper-options">
                    {attempt.question.options.map((option) => <button key={option.key} type="button" className={selectedAnswer === option.key ? 'active' : ''} disabled={attempt.attempt.status === 'submitted'} onClick={() => setSelectedAnswer(option.key)}><b>{option.key}</b><span>{option.text}</span></button>)}
                  </div> : <input value={selectedAnswer} disabled={attempt.attempt.status === 'submitted'} maxLength={500} onChange={(event) => setSelectedAnswer(event.target.value)} placeholder={t('agent.pastPaper.answerPlaceholder', '输入你的答案')} />}
                  {attempt.attempt.status !== 'submitted' ? <button className="agent-past-paper-submit" type="button" disabled={!selectedAnswer.trim() || attemptBusy} onClick={() => void submitAnswer()}><Icon name={attemptBusy ? 'lucide:loader-circle' : 'lucide:check'} />{t('agent.pastPaper.submitAnswer', '提交答案')}</button> : <div className={`agent-past-paper-result ${attempt.attempt.outcome}`}>
                    <strong><Icon name={attempt.attempt.outcome === 'correct' ? 'lucide:circle-check' : 'lucide:circle-x'} />{attempt.attempt.outcome === 'correct' ? t('agent.pastPaper.correct', '回答正确') : t('agent.pastPaper.incorrect', '回答错误')}</strong>
                    <small>{attempt.attempt.evidenceStatus === 'recorded' ? t('agent.pastPaper.evidenceRecorded', '独立结果已进入学习分析') : attempt.attempt.evidenceReasonCode === 'ASSISTANCE_USED' ? t('agent.pastPaper.assistedNotEvidence', '本题使用过辅助，结果不计入独立掌握证据') : t('agent.pastPaper.notEvidence', '结果已保存，但当前题目尚不满足掌握证据标准')}</small>
                    {progress?.nextQuestionId ? <button type="button" onClick={() => setSelectedQuestionId(progress.nextQuestionId)}>{t('agent.pastPaper.nextQuestion', '继续下一题')}<Icon name="lucide:arrow-right" /></button> : null}
                  </div>}
                </section> : null}
                <div className="agent-past-paper-tutor-actions">
                  {(['clarify_question', 'recall_concept', 'next_step_hint'] as const).map((action) => {
                    const state = assistance?.availableActions.find((item) => item.action === action);
                    const label = ASSISTANCE_LABELS[action];
                    return <button key={action} type="button" disabled={Boolean(assistanceBusy) || state?.enabled === false} onClick={() => void requestAssistance(action)}>
                      <Icon name={assistanceBusy === action ? 'lucide:loader-circle' : label.icon} /><span>{locale.startsWith('en') ? label.en : label.zh}</span><small>{state?.level ?? ''}</small>
                    </button>;
                  })}
                </div>
                <div className="agent-past-paper-step-check">
                  <label htmlFor="past-paper-student-work">{t('agent.pastPaper.studentWork', '写下你的当前思路或步骤')}</label>
                  <textarea id="past-paper-student-work" value={studentWork} maxLength={4000} onChange={(event) => setStudentWork(event.target.value)} placeholder={t('agent.pastPaper.studentWorkPlaceholder', '例如：我先设未知数，然后把已知量代入……')} />
                  <button type="button" disabled={Boolean(assistanceBusy) || !studentWork.trim()} onClick={() => void requestAssistance('check_step')}><Icon name={assistanceBusy === 'check_step' ? 'lucide:loader-circle' : ASSISTANCE_LABELS.check_step.icon} />{locale.startsWith('en') ? ASSISTANCE_LABELS.check_step.en : ASSISTANCE_LABELS.check_step.zh}<small>A3</small></button>
                </div>
                <div className="agent-past-paper-assistance-history">
                  {assistance?.history.length ? assistance.history.map((item) => <article key={item.toolCallId}>
                    <div><span>{item.level}</span><strong>{locale.startsWith('en') ? ASSISTANCE_LABELS[item.action].en : ASSISTANCE_LABELS[item.action].zh}</strong></div>
                    <p>{item.content}</p>
                  </article>) : <p className="empty">{t('agent.pastPaper.noAssistance', '按需要选择一级帮助，Agent 不会一开始就把答案告诉你。')}</p>}
                </div>
                <div className="agent-past-paper-full-solution">
                  {solutionArmed ? <div><p>{t('agent.pastPaper.solutionConfirm', '完整解析会暴露答案。确认这次学习过程已不再作为独立作答吗？')}</p><button type="button" disabled={Boolean(assistanceBusy)} onClick={() => void requestAssistance('show_full_solution', true)}>{t('common.confirm', '确认查看')}</button><button type="button" className="secondary" onClick={() => setSolutionArmed(false)}>{t('common.cancel', '取消')}</button></div> : <button type="button" disabled={Boolean(assistanceBusy) || assistance?.availableActions.find((item) => item.action === 'show_full_solution')?.enabled === false} onClick={() => setSolutionArmed(true)}><Icon name={ASSISTANCE_LABELS.show_full_solution.icon} />{locale.startsWith('en') ? ASSISTANCE_LABELS.show_full_solution.en : ASSISTANCE_LABELS.show_full_solution.zh}<small>A6</small></button>}
                </div>
              </> : selectedQuestion ? <p className="agent-past-paper-tutor-empty">{t('agent.pastPaper.answerUnavailable', '本题可以在原卷中阅读，但可信答案尚未就绪，暂不开放作答和分层讲解。')}</p> : <p className="agent-past-paper-tutor-empty">{t('agent.pastPaper.tutorEmpty', '从左侧题目索引选择一道题，才能开始分层讲解。')}</p>}
            </aside>
          </div>
        </> : <div className="agent-past-paper-state"><Icon name="lucide:file-question" /><strong>{t('agent.pastPaper.noFile', '这份真题暂时没有可读文件。')}</strong></div>}
      </main>
    </div>
  );
}
