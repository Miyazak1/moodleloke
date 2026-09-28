import { useEffect, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { AdminStatsStrip } from '../components/admin/AdminWorkbench';
import { useI18n } from '../i18n/useI18n';
import { getQuestionEnginePluginStatus, type QuestionEnginePluginStatus, type User } from '../lib/api';

type AdminQuestionEnginePageProps = {
  currentUser?: User | null;
  onGoToAudit: () => void;
  onGoToContent: () => void;
  onGoToAuth: () => void;
};

const COPY = {
  zh: {
    kicker: '自动出题插件',
    title: '题目引擎接入状态',
    guestTitle: '题目引擎后台',
    body: '通过稳定适配器接入自动出题系统。插件关闭、配置错误或升级时，学生端继续只使用已核验题库。',
    guestBody: '请先登录管理员账号后继续。',
    host: '插件宿主',
    api: '契约版本',
    fallback: '学生回退',
    writes: '生成写入',
    registered: '已注册插件',
    adapterBody: '当前采用受控适配器，不加载任意运行时代码；更新适配器后重启服务即可切换。',
    selected: '当前选中',
    notSelected: '未选中',
    enabled: '已启用',
    disabled: '已关闭',
    ready: '就绪',
    blocked: '配置阻塞',
    safe: '已核验题库',
    stopped: '已停止',
    provider: 'Provider',
    model: '模型',
    capabilities: '能力',
    enforced: '已接管调用',
    blockers: '阻塞原因',
    protocol: '任务协议',
    executionMode: '执行模式',
    signing: '任务签名',
    transport: 'Sidecar 传输',
    nonceStore: '防重放存储',
    activation: 'Sidecar 启用门禁',
    workerCapabilities: 'Worker 能力',
    acceptedWorkerVersions: '兼容 Worker 版本',
    workerRuntime: 'Worker 实时状态',
    circuit: '传输熔断器',
    circuitOpen: '已打开',
    circuitClosed: '已关闭',
    lastCheck: '最近检查',
    latency: '延迟',
    lastSuccess: '最近成功',
    lastFailure: '最近失败',
    notApplicable: '当前不适用',
    unreachable: '无法连接',
    configured: '已配置',
    notConfigured: '未配置',
    noBlockers: '无',
    loading: '正在检查题目引擎…',
    failed: '题目引擎状态暂时无法读取。',
    refresh: '重新检查'
  },
  en: {
    kicker: 'Question-engine plugin',
    title: 'Question engine integration',
    guestTitle: 'Question engine console',
    body: 'Automatic question systems connect through a stable adapter. Students remain on the verified bank while a plugin is disabled, misconfigured, or being upgraded.',
    guestBody: 'Sign in with an administrator account to continue.',
    host: 'Plugin host',
    api: 'Contract version',
    fallback: 'Student fallback',
    writes: 'Generation writes',
    registered: 'Registered plugins',
    adapterBody: 'The host uses controlled adapters and never loads arbitrary runtime code. Restart the service after swapping an adapter.',
    selected: 'Selected',
    notSelected: 'Not selected',
    enabled: 'Enabled',
    disabled: 'Disabled',
    ready: 'Ready',
    blocked: 'Blocked',
    safe: 'Verified bank',
    stopped: 'Stopped',
    provider: 'Provider',
    model: 'Model',
    capabilities: 'Capabilities',
    enforced: 'Enforced calls',
    blockers: 'Blockers',
    protocol: 'Task protocol',
    executionMode: 'Execution mode',
    signing: 'Task signing',
    transport: 'Sidecar transport',
    nonceStore: 'Replay protection store',
    activation: 'Sidecar activation gate',
    workerCapabilities: 'Worker capabilities',
    acceptedWorkerVersions: 'Accepted worker versions',
    workerRuntime: 'Worker runtime',
    circuit: 'Transport circuit',
    circuitOpen: 'Open',
    circuitClosed: 'Closed',
    lastCheck: 'Last check',
    latency: 'Latency',
    lastSuccess: 'Last success',
    lastFailure: 'Last failure',
    notApplicable: 'Not applicable',
    unreachable: 'Unreachable',
    configured: 'Configured',
    notConfigured: 'Not configured',
    noBlockers: 'None',
    loading: 'Checking the question engine…',
    failed: 'Question-engine status is temporarily unavailable.',
    refresh: 'Check again'
  }
} as const;

export function AdminQuestionEnginePage({ currentUser, onGoToAudit, onGoToContent, onGoToAuth }: AdminQuestionEnginePageProps) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? COPY.en : COPY.zh;
  const [status, setStatus] = useState<QuestionEnginePluginStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let active = true;
    setIsLoading(true);
    setError(null);
    getQuestionEnginePluginStatus()
      .then((response) => { if (active) setStatus(response); })
      .catch(() => { if (active) setError(copy.failed); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [copy.failed, currentUser?.role, reloadKey]);

  const plugin = status?.plugins[0];
  const pluginStatus = plugin?.status === 'ready' ? copy.ready : plugin?.status === 'blocked' ? copy.blocked : copy.disabled;
  const workerRuntime = status?.runtime?.worker;
  const runtimeStatus = workerRuntime?.status === 'healthy' ? copy.ready
    : workerRuntime?.status === 'blocked' ? copy.blocked
      : workerRuntime?.status === 'unreachable' ? copy.unreachable : copy.notApplicable;

  return (
    <AdminPageShell
      current="aiOperations"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.title : copy.guestTitle}
      body={currentUser?.role === 'admin' ? copy.body : copy.guestBody}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onGoToAudit}
      onGoToContent={onGoToContent}
      availableSections={['audit', 'content', 'aiOperations']}
    >
      {currentUser?.role === 'admin' && (
        <>
          <AdminStatsStrip
            ariaLabel={copy.title}
            className="admin-audit-overview-kpis"
            items={[
              { key: 'host', label: copy.host, value: plugin?.enabled ? copy.enabled : copy.disabled, detail: pluginStatus },
              { key: 'api', label: copy.api, value: status?.host.apiVersion ?? '—' },
              { key: 'fallback', label: copy.fallback, value: status?.host.fallbackAvailable ? copy.safe : '—' },
              { key: 'writes', label: copy.writes, value: plugin?.generationWritesEnabled ? copy.enabled : copy.stopped }
            ]}
          />
          <section className="process-list admin-compact-section" aria-labelledby="question-engine-plugins-title">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">Plugin registry</p>
                <h2 id="question-engine-plugins-title">{copy.registered}</h2>
              </div>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={isLoading}>{copy.refresh}</button>
            </div>
            <p>{copy.adapterBody}</p>
            {isLoading && !status && <p role="status">{copy.loading}</p>}
            {error && <p role="alert">{error}</p>}
            {plugin && (
              <>
                <article className="process-row">
                  <div>
                    <strong>{plugin.descriptor.displayName} · v{plugin.descriptor.version}</strong>
                    <p>{plugin.selected ? copy.selected : copy.notSelected} · {pluginStatus}</p>
                    <p>{copy.capabilities}：{plugin.descriptor.capabilities.join(' · ')}</p>
                  </div>
                  <div>
                    <strong>{copy.enforced}</strong>
                    <p>{status.host.enforcedCapabilities.join(' · ')}</p>
                  </div>
                </article>
                {status.runtime && (
                  <article className="process-row">
                    <div>
                      <strong>{copy.workerRuntime}：{runtimeStatus}</strong>
                      <p>{copy.lastCheck}：{new Date(status.runtime.worker.checkedAt).toLocaleString()}</p>
                      <p>{copy.latency}：{status.runtime.worker.latencyMs} ms</p>
                      <p>{copy.blockers}：{status.runtime.worker.blockers.join(' · ') || copy.noBlockers}</p>
                    </div>
                    <div>
                      <strong>{copy.circuit}：{status.runtime.transport.circuit.open ? copy.circuitOpen : copy.circuitClosed}</strong>
                      <p>{status.runtime.transport.circuit.consecutiveFailures}/{status.runtime.transport.circuit.threshold || '—'}</p>
                      <p>{copy.lastSuccess}：{status.runtime.transport.lastSuccessAt ? new Date(status.runtime.transport.lastSuccessAt).toLocaleString() : '—'}</p>
                      <p>{copy.lastFailure}：{status.runtime.transport.lastFailure?.code || '—'}</p>
                    </div>
                  </article>
                )}
                <article className="process-row">
                  <div>
                    <strong>{copy.protocol}：{status.host.taskProtocol.version}</strong>
                    <p>{copy.executionMode}：{status.host.taskProtocol.executionMode}</p>
                  </div>
                  <div>
                    <strong>{copy.signing}</strong>
                    <p>{status.host.taskProtocol.signingConfigured ? copy.configured : copy.notConfigured}</p>
                    <p>{copy.transport}：{status.host.taskProtocol.transportImplemented ? copy.configured : copy.notConfigured}</p>
                    <p>{copy.nonceStore}：{status.host.taskProtocol.nonceStoreConfigured ? copy.configured : copy.notConfigured}</p>
                    <p>{copy.activation}：{status.host.taskProtocol.sidecarActivationEnabled ? copy.enabled : copy.disabled}</p>
                    <p>{copy.workerCapabilities}：{status.host.taskProtocol.workerCapabilities.join(' · ') || copy.noBlockers}</p>
                    <p>{copy.acceptedWorkerVersions}：{status.host.taskProtocol.acceptedWorkerVersions.join(' · ') || copy.notConfigured}</p>
                  </div>
                </article>
                {plugin.capabilityStates.map((capability) => (
                  <article className="process-row" key={capability.capability}>
                    <div>
                      <strong>{capability.capability}</strong>
                      <p>{capability.status === 'ready' ? copy.ready : capability.status === 'blocked' ? copy.blocked : copy.disabled}</p>
                    </div>
                    <div>
                      <strong>{copy.provider}：{capability.provider}</strong>
                      <p>{copy.model}：{capability.model || '—'}</p>
                      <p>{copy.blockers}：{capability.blockers.length ? capability.blockers.join(' · ') : copy.noBlockers}</p>
                    </div>
                  </article>
                ))}
              </>
            )}
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
