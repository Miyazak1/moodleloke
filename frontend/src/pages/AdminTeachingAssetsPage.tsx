import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import type { User } from '../lib/api';
import {
  actOnAdminTeachingAssetQualityAlert, createAdminTeachingAsset, createAdminTeachingAssetVersion, getAdminTeachingAsset, listAdminTeachingAssets,
  getAdminTeachingAssetAnalytics, getAdminTeachingAssetRoutingDiagnostics, listAdminTeachingAssetQualityAlerts, transitionAdminTeachingAssetVersion, updateAdminTeachingAssetVersion,
  type AdminTeachingAsset, type AdminTeachingAssetAnalytics, type AdminTeachingAssetQualityQueue, type AdminTeachingAssetRoutingDiagnostics, type AdminTeachingAssetTopic, type AdminTeachingAssetVersionInput
} from '../lib/api-admin-teaching-assets';
import { TeachingAssetRenderer } from '../components/agent/TeachingAssetRegistry';
import type { AgentTeachingAsset } from '../lib/api-agent';
import '../styles/agent.css';

type Props = { currentUser: User | null; onGoToAuth: () => void };
type Subject = 'math' | 'physics' | 'chemistry';
type Draft = AdminTeachingAssetVersionInput & { stableKey: string; subjectCode: Subject };

const SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];
const componentFor = (subject: Subject) => subject === 'math' ? 'math.function-horizontal-shift' : subject === 'physics' ? 'physics.newton-second-law' : 'chemistry.acid-base-neutralization';
function payloadFor(subject: Subject) {
  if (subject === 'physics') return {
    schemaVersion: '1', title: '用 F=ma 看懂力、质量与加速度', summary: '调节合力和质量，观察加速度如何变化。',
    instructions: ['保持质量不变并增大合力。', '保持合力不变并增大质量。', '用 a=F/m 解释变化。'],
    component: { key: componentFor(subject), version: '1', props: { forceMin: 2, forceMax: 20, initialForce: 8, massMin: 1, massMax: 8, initialMass: 2 } },
    activePrompt: { id: 'newton-check-v1', prompt: '合力不变，质量加倍，加速度如何变化？', options: [{ id: 'double', label: '加倍' }, { id: 'half', label: '减半' }, { id: 'same', label: '不变' }], correctAnswer: 'half', correctFeedback: '正确。', incorrectFeedback: '请回到 a=F/m 再观察。' },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  if (subject === 'chemistry') return {
    schemaVersion: '1', title: '用粒子份数看懂酸碱中和', summary: '调节 H⁺ 和 OH⁻ 份数，观察反应后谁过量。',
    instructions: ['先让酸过量。', '再让碱过量。', '最后调成恰好中和。'],
    component: { key: componentFor(subject), version: '1', props: { acidMin: 0, acidMax: 10, initialAcid: 6, baseMin: 0, baseMax: 10, initialBase: 4 } },
    activePrompt: { id: 'neutralization-check-v1', prompt: '一元强酸与一元强碱等物质的量完全反应后呈什么性质？', options: [{ id: 'acidic', label: '酸性' }, { id: 'neutral', label: '中性' }, { id: 'basic', label: '碱性' }], correctAnswer: 'neutral', correctFeedback: '正确。', incorrectFeedback: '比较反应后 H⁺ 与 OH⁻ 是否过量。' },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
  return {
    schemaVersion: '1', title: '看懂函数图像的水平平移', summary: '拖动 h，观察函数顶点如何移动。',
    instructions: ['先把 h 调到 0。', '再尝试正数和负数。', '用顶点横坐标等于 h 来判断。'],
    component: { key: componentFor(subject), version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
    activePrompt: { id: 'shift-check-v1', prompt: 'h=3 时顶点在哪里？', options: [{ id: 'left', label: '(-3,0)' }, { id: 'right', label: '(3,0)' }], correctAnswer: 'right', correctFeedback: '正确。', incorrectFeedback: '令 x-h=0 后再判断。' },
    verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
  };
}
function newDraft(subject: Subject, topics: AdminTeachingAssetTopic[]): Draft {
  const payload = payloadFor(subject);
  const topic = topics.find((item) => item.subject === subject);
  return {
    stableKey: componentFor(subject), subjectCode: subject, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3,
    renderer: 'interactive_component', componentKey: componentFor(subject), componentVersion: '1', payloadSchemaVersion: `${componentFor(subject).split('.').slice(1).join('-')}-v1`,
    payload, fallbackPayload: { title: payload.title, body: payload.summary }, sourceRefs: topic ? [{ type: 'syllabus_topic', id: String(topic.id), version: topic.syllabusVersion || 'current' }] : [], topicIds: topic ? [topic.id] : []
  };
}
function draftFromAsset(asset: AdminTeachingAsset): Draft {
  const version = asset.versions[0];
  return { stableKey: asset.stableKey, subjectCode: asset.subjectCode, language: version.language, difficultyBand: version.difficultyBand, estimatedMinutes: version.estimatedMinutes, renderer: 'interactive_component', componentKey: version.componentKey, componentVersion: '1', payloadSchemaVersion: version.payloadSchemaVersion, payload: version.payload, fallbackPayload: version.fallbackPayload, sourceRefs: version.sourceRefs, topicIds: asset.topics.map((item) => item.topic.id) };
}
function percent(value: number | null) { return value === null ? '样本不足' : `${Math.round(value * 100)}%`; }
const SIGNAL_LABEL = { insufficient_data: '数据不足', healthy: '表现健康', watch: '继续观察', review: '建议复核' } as const;
const ALERT_STATUS_LABEL = { open: '待处理', acknowledged: '已确认', resolved: '已解决' } as const;

export function AdminTeachingAssetsPage({ currentUser, onGoToAuth }: Props) {
  const [items, setItems] = useState<AdminTeachingAsset[]>([]);
  const [topics, setTopics] = useState<AdminTeachingAssetTopic[]>([]);
  const [selected, setSelected] = useState<AdminTeachingAsset | null>(null);
  const [draft, setDraft] = useState<Draft>(() => newDraft('math', []));
  const [creating, setCreating] = useState(false);
  const [payloadText, setPayloadText] = useState('{}');
  const [fallbackText, setFallbackText] = useState('{}');
  const [sourceText, setSourceText] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminTeachingAssetAnalytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [qualityQueue, setQualityQueue] = useState<AdminTeachingAssetQualityQueue | null>(null);
  const [routingDiagnostics, setRoutingDiagnostics] = useState<AdminTeachingAssetRoutingDiagnostics | null>(null);
  const [qualityNotes, setQualityNotes] = useState<Record<string, string>>({});

  async function load(selectId?: string) {
    const [result, alerts, routing] = await Promise.all([listAdminTeachingAssets(), listAdminTeachingAssetQualityAlerts(analyticsDays), getAdminTeachingAssetRoutingDiagnostics(analyticsDays)]);
    setItems(result.items); setTopics(result.topics);
    setQualityQueue(alerts);
    setRoutingDiagnostics(routing);
    const id = selectId ?? selected?.id ?? result.items[0]?.id;
    if (id) {
      const [detail, metrics] = await Promise.all([getAdminTeachingAsset(id), getAdminTeachingAssetAnalytics(id, analyticsDays)]);
      setSelected(detail.item); setCreating(false); applyDraft(draftFromAsset(detail.item));
      setAnalytics(metrics);
    } else startNew('math', result.topics);
  }
  useEffect(() => { if (currentUser?.role === 'admin') void load().catch((reason) => setError(reason instanceof Error ? reason.message : '加载失败')); }, [currentUser?.id]);
  function applyDraft(next: Draft) { setDraft(next); setPayloadText(JSON.stringify(next.payload, null, 2)); setFallbackText(JSON.stringify(next.fallbackPayload, null, 2)); setSourceText(JSON.stringify(next.sourceRefs, null, 2)); }
  function startNew(subject: Subject, availableTopics = topics) { setCreating(true); setSelected(null); setAnalytics(null); applyDraft(newDraft(subject, availableTopics)); setError(null); setFeedback(null); }
  async function open(id: string) { setBusy(true); setError(null); try { const [result, metrics] = await Promise.all([getAdminTeachingAsset(id), getAdminTeachingAssetAnalytics(id, analyticsDays)]); setSelected(result.item); setAnalytics(metrics); setCreating(false); applyDraft(draftFromAsset(result.item)); } catch (reason) { setError(reason instanceof Error ? reason.message : '加载失败'); } finally { setBusy(false); } }
  async function refreshAnalytics(days: number) { if (!selected) return; setBusy(true); setError(null); try { setAnalyticsDays(days); const [metrics, alerts, routing] = await Promise.all([getAdminTeachingAssetAnalytics(selected.id, days), listAdminTeachingAssetQualityAlerts(days), getAdminTeachingAssetRoutingDiagnostics(days)]); setAnalytics(metrics); setQualityQueue(alerts); setRoutingDiagnostics(routing); } catch (reason) { setError(reason instanceof Error ? reason.message : '效果数据加载失败'); } finally { setBusy(false); } }
  async function actOnAlert(alertKey: string, actionName: 'acknowledge' | 'resolve' | 'reopen') {
    const reason = qualityNotes[alertKey]?.trim();
    if (!reason) { setError('请先填写质量告警的处理说明。'); return; }
    setBusy(true); setError(null); setFeedback(null);
    try { setQualityQueue(await actOnAdminTeachingAssetQualityAlert(alertKey, actionName, reason)); setFeedback('质量告警状态已记录，内容发布状态未被自动修改。'); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : '质量告警操作失败'); }
    finally { setBusy(false); }
  }
  function parsedInput(): AdminTeachingAssetVersionInput {
    return { ...draft, payload: JSON.parse(payloadText), fallbackPayload: JSON.parse(fallbackText), sourceRefs: JSON.parse(sourceText), topicIds: draft.topicIds };
  }
  async function save() {
    setBusy(true); setError(null); setFeedback(null);
    try {
      const input = parsedInput();
      const result = creating
        ? await createAdminTeachingAsset({ ...input, stableKey: draft.stableKey, subjectCode: draft.subjectCode, type: 'micro_lesson' })
        : await updateAdminTeachingAssetVersion(selected!.versions[0].id, input);
      setSelected(result.item); setCreating(false); applyDraft(draftFromAsset(result.item)); setFeedback('草稿已保存并通过服务端组件校验。'); await load(result.item.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setBusy(false); }
  }
  async function action(name: 'submit' | 'approve' | 'return' | 'publish' | 'retire') {
    if (!selected) return; setBusy(true); setError(null); setFeedback(null);
    try { const result = await transitionAdminTeachingAssetVersion(selected.versions[0].id, name); setSelected(result.item); applyDraft(draftFromAsset(result.item)); setFeedback('状态已更新。'); await load(result.item.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败'); } finally { setBusy(false); }
  }
  async function createVersion() { if (!selected) return; setBusy(true); setError(null); try { const result = await createAdminTeachingAssetVersion(selected.id); setSelected(result.item); applyDraft(draftFromAsset(result.item)); setFeedback('新版本草稿已创建，线上版本保持发布。'); await load(result.item.id); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建版本失败'); } finally { setBusy(false); } }
  const latest = selected?.versions[0];
  const editable = creating || latest?.status === 'draft';
  const topicBindingLocked = Boolean(selected?.versions.some((version) => version.status === 'published'));
  const preview = useMemo(() => {
    try {
      const payload = JSON.parse(payloadText) as any;
      return { id: selected?.id || 'preview', stableKey: draft.stableKey, type: 'micro_lesson', subjectCode: draft.subjectCode, versionId: latest?.id || 'preview-v1', version: latest?.version || 1, language: draft.language, difficultyBand: draft.difficultyBand, estimatedMinutes: draft.estimatedMinutes, renderer: 'interactive_component', payloadSchemaVersion: draft.payloadSchemaVersion, resolverVersion: 'admin-preview', topicTitle: topics.find((topic) => draft.topicIds.includes(topic.id))?.title || '未选择知识点', title: payload.title, summary: payload.summary, instructions: payload.instructions, component: payload.component, activePrompt: { id: payload.activePrompt.id, prompt: payload.activePrompt.prompt, options: payload.activePrompt.options }, verificationPolicy: payload.verificationPolicy, fallback: JSON.parse(fallbackText), sourceRefs: JSON.parse(sourceText), reviewState: latest?.reviewState || 'not_submitted', publishedAt: latest?.publishedAt || null } as AgentTeachingAsset;
    } catch { return null; }
  }, [payloadText, fallbackText, sourceText, draft, latest, selected, topics]);

  return <AdminPageShell current="teachingAssets" currentUser={currentUser} onGoToAuth={onGoToAuth} kicker="教学资产" title="教学内容运营工作台" body="创建、审核和发布 Agent 可调用的交互微课；线上版本在新草稿审核期间保持可用。" className="teaching-assets-admin">
    {error && <section className="admin-feedback warning"><strong>操作未完成</strong><p>{error}</p></section>}
    {feedback && <section className="admin-feedback success"><strong>操作成功</strong><p>{feedback}</p></section>}
    {routingDiagnostics && <section className="teaching-assets-routing-diagnostics">
      <header><div><span>个性化路由发布门</span><h2>{routingDiagnostics.gate.qualified ? 'Shadow 指标达标' : '继续采集 Shadow 样本'}</h2></div><div className={`routing-mode ${routingDiagnostics.currentMode}`}>当前 {routingDiagnostics.currentMode}{routingDiagnostics.currentMode === 'active' ? ` · ${routingDiagnostics.rollout.percent}%` : ''}</div></header>
      <p>新旧策略双轨比较，不会自动切换线上模式。只有样本、覆盖、回退、探索和延迟同时达标后，才允许人工灰度。</p>
      <div className="teaching-assets-routing-metrics">
        <article><span>决策样本</span><strong>{routingDiagnostics.metrics.decisions}</strong><small>门槛 {routingDiagnostics.gate.minimumDecisions}</small></article>
        <article><span>个性化覆盖</span><strong>{percent(routingDiagnostics.metrics.coverageRate)}</strong><small>回退 {percent(routingDiagnostics.metrics.fallbackRate)}</small></article>
        <article><span>新旧分歧</span><strong>{percent(routingDiagnostics.metrics.divergenceRate)}</strong><small>替换无效讲解 {routingDiagnostics.metrics.alternateAfterIneffectiveCount} 次</small></article>
        <article><span>受控探索</span><strong>{percent(routingDiagnostics.metrics.explorationRate)}</strong><small>上限 20%</small></article>
        <article><span>P95 延迟</span><strong>{routingDiagnostics.metrics.p95LatencyMs === null ? '暂无' : `${routingDiagnostics.metrics.p95LatencyMs}ms`}</strong><small>上限 250ms</small></article>
      </div>
      <div className="teaching-assets-routing-reasons"><span>灰度学科：{routingDiagnostics.rollout.subjects.join('、') || '未配置'}</span>{routingDiagnostics.gate.reasonCodes.map((code) => <span key={code}>{code}</span>)}</div>
      <section className="teaching-assets-routing-outcomes" data-circuit={routingDiagnostics.learningOutcomes.circuit.status}>
        <header><div><span>学习效果闭环</span><strong>{routingDiagnostics.learningOutcomes.circuit.status === 'tripped' ? '已自动降级为 Shadow' : routingDiagnostics.learningOutcomes.evidenceQualified ? '效果样本已具备比较条件' : '正在积累独立验证样本'}</strong></div><small>{routingDiagnostics.learningOutcomes.observations} 条已关联教学交付</small></header>
        <div>
          <article><span>基线组验证通过率</span><strong>{percent(routingDiagnostics.learningOutcomes.cohorts.baseline.verificationPassRate)}</strong><small>{routingDiagnostics.learningOutcomes.cohorts.baseline.conclusiveVerifications} 次有效验证</small></article>
          <article><span>Active 组验证通过率</span><strong>{percent(routingDiagnostics.learningOutcomes.cohorts.active.verificationPassRate)}</strong><small>{routingDiagnostics.learningOutcomes.cohorts.active.conclusiveVerifications} 次有效验证</small></article>
          <article><span>Active 相对变化</span><strong>{percent(routingDiagnostics.learningOutcomes.comparison.verificationPassRateDelta)}</strong><small>稳定掌握变化 {percent(routingDiagnostics.learningOutcomes.comparison.stableRateDelta)}</small></article>
          <article><span>连续即时失败</span><strong>{routingDiagnostics.learningOutcomes.comparison.consecutiveActiveImmediateFailures}</strong><small>达到 5 次触发保护</small></article>
        </div>
        {routingDiagnostics.learningOutcomes.circuit.reasonCodes.length > 0 && <p>{routingDiagnostics.learningOutcomes.circuit.reasonCodes.join(' · ')}</p>}
      </section>
      <details><summary>最近双轨决策</summary>{routingDiagnostics.recent.length === 0 ? <p>尚无 Shadow 决策记录。</p> : <div className="teaching-assets-routing-recent">{routingDiagnostics.recent.slice(0, 12).map((item) => <article key={`${item.contextKey}-${item.createdAt}`}><strong>{item.subject} · {item.contextType}</strong><span>{item.diverged ? '新旧结果不同' : '新旧结果一致'}{item.personalizedFallback ? ' · 个性化回退' : ''}{item.boundedExploration ? ' · 探索' : ''}</span><small>学生 {item.studentRef} · {item.latencyMs ?? '-'}ms · {item.reasonCodes.join(', ') || '无原因码'}</small></article>)}</div>}</details>
    </section>}
    {qualityQueue && <section className="teaching-assets-quality-queue">
      <header><div><span>质量复核队列</span><h2>{qualityQueue.summary.open + qualityQueue.summary.acknowledged} 项待跟进</h2></div><div><span>{qualityQueue.summary.review} 项建议复核</span><span>{qualityQueue.summary.watch} 项观察</span><span>{qualityQueue.summary.insufficientData} 项数据不足</span></div></header>
      {qualityQueue.items.length === 0 ? <p className="teaching-assets-quality-empty">当前没有需要复核的线上教学资产。</p> : <div className="teaching-assets-quality-list">{qualityQueue.items.map((alert) => <article key={alert.alertKey} data-severity={alert.severity}>
        <div className="teaching-assets-quality-main"><span>{alert.asset.subjectCode} · v{alert.version.version} · {SIGNAL_LABEL[alert.signal]}</span><strong>{alert.asset.stableKey}</strong><small>{alert.reasonCodes.includes('version_regression') ? '新版本相较上一版本出现显著退化' : alert.signal === 'insufficient_data' ? '尚未达到可信判断的最低样本' : '当前效果指标低于运营阈值'}</small></div>
        <div className="teaching-assets-quality-metrics"><span>完成 {percent(alert.metrics.completionRate)}</span><span>首次正确 {percent(alert.metrics.activePrompt.firstTryCorrectRate)}</span><span>独立验证 {percent(alert.metrics.independentVerification.passRate)}</span></div>
        <div className="teaching-assets-quality-workflow"><span>{ALERT_STATUS_LABEL[alert.workflow.status]}</span><input value={qualityNotes[alert.alertKey] ?? ''} onChange={(event) => setQualityNotes({ ...qualityNotes, [alert.alertKey]: event.target.value })} placeholder="填写确认、解决或重新打开原因" />{alert.workflow.status === 'open' && <button type="button" disabled={busy} onClick={() => void actOnAlert(alert.alertKey, 'acknowledge')}>确认跟进</button>}{alert.workflow.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => void actOnAlert(alert.alertKey, 'resolve')}>标记解决</button>}{alert.workflow.status === 'resolved' && <button type="button" disabled={busy} onClick={() => void actOnAlert(alert.alertKey, 'reopen')}>重新打开</button>}</div>
      </article>)}</div>}
    </section>}
    <section className="teaching-assets-workspace">
      <aside className="teaching-assets-list"><header><div><span>资产目录</span><strong>{items.length} 项</strong></div><button type="button" onClick={() => startNew('math')}>新建</button></header>
        {items.map((item) => <button type="button" key={item.id} className={selected?.id === item.id ? 'active' : ''} onClick={() => void open(item.id)}><span>{item.subjectCode} · {item.status}</span><strong>{item.stableKey}</strong><small>{item.topics.map((entry) => entry.topic.title).join('、') || '未绑定知识点'} · {item._count?.exposures ?? 0} 次曝光</small></button>)}
      </aside>
      <div className="teaching-assets-editor">
        <header><div><span>{creating ? '新资产草稿' : `版本 v${latest?.version} · ${latest?.status}`}</span><h2>{draft.stableKey}</h2></div><div className="teaching-assets-actions">
          {editable && <button type="button" onClick={() => void save()} disabled={busy}>保存草稿</button>}
          {!creating && latest?.status === 'draft' && <button type="button" onClick={() => void action('submit')} disabled={busy}>提交审核</button>}
          {latest?.status === 'review' && <><button type="button" onClick={() => void action('return')} disabled={busy}>退回修改</button><button type="button" onClick={() => void action('approve')} disabled={busy}>审核通过</button></>}
          {latest?.status === 'approved' && <button type="button" onClick={() => void action('publish')} disabled={busy}>发布上线</button>}
          {latest?.status === 'published' && <><button type="button" onClick={() => void createVersion()} disabled={busy}>创建新版本</button><button type="button" className="danger" onClick={() => void action('retire')} disabled={busy}>下架</button></>}
        </div></header>
        {analytics && <section className="teaching-assets-analytics">
          <header><div><span>效果反馈</span><strong>{SIGNAL_LABEL[analytics.aggregate.operationalSignal.signal]}</strong></div><label>统计窗口<select value={analyticsDays} disabled={busy} onChange={(event) => void refreshAnalytics(Number(event.target.value))}><option value={7}>近 7 天</option><option value={30}>近 30 天</option><option value={90}>近 90 天</option></select></label></header>
          <p className="teaching-assets-analytics-note">完成微课不等于掌握；最终效果以无提示的新题验证为准。当前信号仅供运营复核，不会自动下架内容或修改掌握度。</p>
          <div className="teaching-assets-metric-grid">
            <article><span>互动上下文</span><strong>{analytics.aggregate.exposureContexts}</strong><small>{analytics.aggregate.uniqueLearners} 名学生</small></article>
            <article><span>完成率</span><strong>{percent(analytics.aggregate.completionRate)}</strong><small>{analytics.aggregate.completedContexts} 次完成</small></article>
            <article><span>即时检查首次正确</span><strong>{percent(analytics.aggregate.activePrompt.firstTryCorrectRate)}</strong><small>{analytics.aggregate.activePrompt.firstAttempts} 个首次作答</small></article>
            <article className="primary"><span>独立新题通过率</span><strong>{percent(analytics.aggregate.independentVerification.passRate)}</strong><small>{analytics.aggregate.independentVerification.conclusive} 个有效结果</small></article>
          </div>
          <div className="teaching-assets-verification-row">
            {analytics.aggregate.independentVerification.phases.map((phase) => <span key={phase.phase}><strong>{phase.phase === 'immediate' ? '即时' : phase.phase === 'retention' ? '保持' : '迁移'}</strong>{phase.passed}/{phase.total} 通过</span>)}
            <span><strong>稳定掌握</strong>{analytics.aggregate.stability.stable} 人</span>
          </div>
          <details><summary>按版本查看</summary><div className="teaching-assets-version-metrics">{analytics.versions.map((version) => <article key={version.id}><strong>v{version.version} · {version.language}</strong><span>{version.status}</span><small>{version.metrics.exposureContexts} 次互动 · 完成 {percent(version.metrics.completionRate)} · 独立验证 {percent(version.metrics.independentVerification.passRate)}</small></article>)}</div></details>
        </section>}
        <div className="teaching-assets-form-grid">
          <label>学科<select value={draft.subjectCode} disabled={!creating} onChange={(event) => startNew(event.target.value as Subject)}>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
          <label>稳定键<input value={draft.stableKey} disabled={!creating} onChange={(event) => setDraft({ ...draft, stableKey: event.target.value })} /></label>
          <label>知识点<select multiple value={draft.topicIds.map(String)} disabled={!editable || topicBindingLocked} title={topicBindingLocked ? '已有线上版本，知识点绑定已锁定' : undefined} onChange={(event) => setDraft({ ...draft, topicIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) })}>{topics.filter((topic) => topic.subject === draft.subjectCode).map((topic) => <option key={topic.id} value={topic.id}>{topic.code} · {topic.title}</option>)}</select></label>
          <label>预计分钟<input type="number" min="1" max="120" value={draft.estimatedMinutes} disabled={!editable} onChange={(event) => setDraft({ ...draft, estimatedMinutes: Number(event.target.value) })} /></label>
          <label>难度带<input value={draft.difficultyBand} disabled={!editable} onChange={(event) => setDraft({ ...draft, difficultyBand: event.target.value })} /></label>
          <label>语言<select value={draft.language} disabled={!editable} onChange={(event) => setDraft({ ...draft, language: event.target.value as Draft['language'] })}><option>zh-CN</option><option>en</option><option>vi</option></select></label>
        </div>
        <label className="teaching-assets-json">教学 payload（严格白名单 JSON）<textarea value={payloadText} disabled={!editable} onChange={(event) => setPayloadText(event.target.value)} spellCheck={false} /></label>
        <div className="teaching-assets-json-grid"><label>降级内容 JSON<textarea value={fallbackText} disabled={!editable} onChange={(event) => setFallbackText(event.target.value)} spellCheck={false} /></label><label>事实来源 JSON<textarea value={sourceText} disabled={!editable} onChange={(event) => setSourceText(event.target.value)} spellCheck={false} /></label></div>
        <section className="teaching-assets-preview"><header><span>真实组件预览</span><small>预览交互不写学习证据</small></header>{preview ? <div className="agent-intervention-teaching-wrap"><TeachingAssetRenderer asset={preview} recordInteraction={async ({ action, value }) => { const prompt = (JSON.parse(payloadText) as any).activePrompt; const correct = action === 'active_prompt_answered' ? String(value) === prompt.correctAnswer : null; return { schemaVersion: '1', eventId: 'preview', status: action === 'completed' ? 'completed' : 'recorded', action, correct, feedback: correct === null ? null : correct ? prompt.correctFeedback : prompt.incorrectFeedback, masteryChanged: false, verificationRequired: action === 'completed' }; }} /></div> : <p>JSON 无法解析，修正后显示预览。</p>}</section>
      </div>
    </section>
  </AdminPageShell>;
}
