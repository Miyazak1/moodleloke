import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminQuestionSupplyFulfillmentPlans,
  getAdminQuestionSupplyAcceptanceReport,
  getAdminQuestionSupplyOperationsHealth,
  exportAdminQuestionSupplyEvidence,
  runAdminQuestionSupplyFulfillment,
  type AdminQuestionSupplyAcceptanceReport,
  type AdminQuestionSupplyEvaluation,
  type AdminQuestionSupplyFulfillmentPlan,
  type AdminQuestionSupplyOperationsHealth,
  type AdminQuestionSupplySchedulerStatus
} from '../../lib/api-admin';
import { ApiError } from '../../lib/request';
import { AdminActionBar, AdminPanel, AdminPanelHeader } from './AdminWorkbench';

type Props = { locale: string };

function compactError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

function percent(value: number | null) {
  return value === null ? '-' : `${Math.round(value * 1000) / 10}%`;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function healthAlertLabel(code: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    SCHEDULER_NEVER_RAN: ['调度器尚未运行', 'Scheduler has not run'],
    SCHEDULER_LAST_RUN_FAILED: ['最近一次调度失败', 'Latest scheduler run failed'],
    SCHEDULER_LEASE_EXPIRED: ['调度租约已过期', 'Scheduler lease expired'],
    SCHEDULER_OVERDUE: ['调度运行已逾期', 'Scheduler run is overdue'],
    STALE_OPEN_REQUESTS: ['存在长期未更新的开放缺口', 'Open gaps are stale'],
    FAILED_FULFILLMENT_PLANS: ['存在等待重试的失败计划', 'Fulfillment plans need retry'],
    EXPIRED_PLAN_LEASES: ['存在过期计划租约', 'Plan leases expired'],
    INVENTORY_CHECK_FAILURE_RATE_HIGH: ['库存复核失败率过高', 'Inventory check failure rate is high'],
    SUBJECT_HAS_NO_RECENT_CHECKS: ['该学科缺少近期复核', 'Subject has no recent checks']
  };
  return labels[code]?.[zh ? 0 : 1] ?? code;
}

export function QuestionSupplyFulfillmentPanel({ locale }: Props) {
  const zh = locale !== 'en';
  const [items, setItems] = useState<AdminQuestionSupplyFulfillmentPlan[]>([]);
  const [evaluation, setEvaluation] = useState<AdminQuestionSupplyEvaluation | null>(null);
  const [report, setReport] = useState<AdminQuestionSupplyAcceptanceReport | null>(null);
  const [scheduler, setScheduler] = useState<AdminQuestionSupplySchedulerStatus | null>(null);
  const [health, setHealth] = useState<AdminQuestionSupplyOperationsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plans, nextReport, nextHealth] = await Promise.all([
        getAdminQuestionSupplyFulfillmentPlans(50),
        getAdminQuestionSupplyAcceptanceReport(30),
        getAdminQuestionSupplyOperationsHealth()
      ]);
      setItems(plans.items);
      setEvaluation(nextReport.overall);
      setReport(nextReport);
      setScheduler(nextHealth.scheduler);
      setHealth(nextHealth);
    } catch (nextError) {
      setError(compactError(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => items.reduce<Record<string, number>>((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, {}), [items]);

  async function runCycle() {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runAdminQuestionSupplyFulfillment(25);
      setNotice(zh
        ? `复核 ${result.reconciled.length} 个缺口，新增 ${result.materialized.filter((item) => item.created).length} 个 Shadow 计划。`
        : `Reconciled ${result.reconciled.length} gaps and created ${result.materialized.filter((item) => item.created).length} shadow plans.`);
      await load();
    } catch (nextError) {
      setError(compactError(nextError));
    } finally {
      setRunning(false);
    }
  }

  async function exportEvidence(format: 'json' | 'csv') {
    setError(null);
    try {
      const result = await exportAdminQuestionSupplyEvidence(format, 30);
      const content = typeof result.content === 'string' ? result.content : `${JSON.stringify(result.content, null, 2)}\n`;
      downloadFile(result.file.name, content, result.file.mimeType);
    } catch (nextError) {
      setError(compactError(nextError));
    }
  }

  return (
    <AdminPanel className="admin-question-supply-panel">
      <AdminPanelHeader
        kicker={zh ? 'Agent 题源交接' : 'Agent supply handoff'}
        title={zh ? '审核库存补充 Shadow' : 'Reviewed inventory replenishment shadow'}
        actions={(
          <AdminActionBar>
            <button type="button" className="ghost-button" disabled={loading} onClick={() => void exportEvidence('json')}>
              {zh ? '导出 JSON' : 'Export JSON'}
            </button>
            <button type="button" className="ghost-button" disabled={loading} onClick={() => void exportEvidence('csv')}>
              {zh ? '导出 CSV' : 'Export CSV'}
            </button>
            <button type="button" className="ghost-button" disabled={loading || running} onClick={() => void load()}>
              {zh ? '刷新' : 'Refresh'}
            </button>
            <button type="button" disabled={loading || running} onClick={() => void runCycle()}>
              {running ? (zh ? '正在复核…' : 'Reconciling…') : (zh ? '运行一次复核' : 'Run reconciliation')}
            </button>
          </AdminActionBar>
        )}
      >
        <p>{zh
          ? '只记录内容侧需求并复核已审核库存；不会调用生成模型，也不会自动审核或发布。'
          : 'Records content demand and checks reviewed inventory only; it never invokes generation, review, or publishing.'}</p>
      </AdminPanelHeader>

      {scheduler && (
        <p className="form-hint">
          {zh ? '自动复核' : 'Automatic reconciliation'}: {scheduler.enabled ? (zh ? '已开启' : 'enabled') : (zh ? '已关闭' : 'disabled')}
          {' · '}{scheduler.configuration.intervalMinutes} min
          {' · '}{zh ? '最近状态' : 'last status'}: {scheduler.state?.lastStatus ?? '-'}
          {scheduler.state?.lastCompletedAt ? ` · ${new Date(scheduler.state.lastCompletedAt).toLocaleString()}` : ''}
          {scheduler.state?.lastErrorCode ? ` · ${scheduler.state.lastErrorCode}` : ''}
        </p>
      )}

      {health && (
        <>
          <div className="metric-grid four">
            <div><span>{zh ? '运营健康度' : 'Operations health'}</span><strong>{health.status}</strong></div>
            <div><span>{zh ? '开放缺口' : 'Open gaps'}</span><strong>{health.summary.openRequests}</strong></div>
            <div><span>{zh ? '24h 复核' : 'Checks in 24h'}</span><strong>{health.summary.checks24h}</strong></div>
            <div><span>{zh ? '复核失败率' : 'Check failure rate'}</span><strong>{percent(health.summary.checkFailureRate)}</strong></div>
          </div>
          {health.alerts.length > 0 && (
            <div className="admin-list compact">
              {health.alerts.map((alert, index) => (
                <div key={`${alert.code}-${alert.subjectCode ?? 'all'}-${index}`}>
                  <strong>{alert.severity} · {healthAlertLabel(alert.code, zh)}</strong>
                  <span>{alert.subjectCode ?? (zh ? '全部学科' : 'all subjects')}{alert.count === undefined ? '' : ` · ${alert.count}`}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="metric-grid four">
        <div><span>{zh ? '全部计划' : 'Plans'}</span><strong>{items.length}</strong></div>
        <div><span>{zh ? '已记录' : 'Shadow recorded'}</span><strong>{counts.shadow_dispatched ?? 0}</strong></div>
        <div><span>{zh ? '待重试' : 'Retrying'}</span><strong>{counts.failed ?? 0}</strong></div>
        <div><span>{zh ? '库存已恢复' : 'Inventory recovered'}</span><strong>{counts.completed ?? 0}</strong></div>
      </div>

      {evaluation && (
        <>
          <div className="metric-grid four">
            <div><span>{zh ? '证据门状态' : 'Evidence gate'}</span><strong>{evaluation.gate.status}</strong></div>
            <div><span>{zh ? '缺口确认率' : 'Shortage confirmed'}</span><strong>{percent(evaluation.summary.shortageConfirmationRate)}</strong></div>
            <div><span>{zh ? '恢复后可执行率' : 'Recovery executable'}</span><strong>{percent(evaluation.summary.recoveryExecutableRate)}</strong></div>
            <div><span>{zh ? '恢复 P90' : 'Recovery P90'}</span><strong>{evaluation.summary.recoveryP90Hours === null ? '-' : `${evaluation.summary.recoveryP90Hours}h`}</strong></div>
          </div>
          <p className="form-hint">
            {zh ? '近 30 天' : 'Last 30 days'} · {zh ? '检查周期' : 'checked cycles'} {evaluation.summary.checkedCycles}
            {' · '}{zh ? '完成周期' : 'completed cycles'} {evaluation.summary.completedCycles}
            {' · '}{zh ? '真实适配器未授权' : 'real adapter not authorized'}
          </p>
          {evaluation.gate.blockers.length > 0 && (
            <p className="form-hint">{zh ? '阻断项' : 'Blockers'}: {evaluation.gate.blockers.join(' · ')}</p>
          )}
        </>
      )}

      {report && (
        <div className="admin-list compact">
          {report.subjects.map(({ subjectCode, evaluation: subjectEvaluation }) => (
            <div key={subjectCode}>
              <strong>{subjectCode} · {subjectEvaluation.gate.status}</strong>
              <span>
                {zh ? '检查/完成' : 'checked/completed'}: {subjectEvaluation.summary.checkedCycles}/{subjectEvaluation.summary.completedCycles}
                {' · '}{zh ? '缺口确认' : 'shortage'} {percent(subjectEvaluation.summary.shortageConfirmationRate)}
                {' · '}{zh ? '恢复可执行' : 'executable'} {percent(subjectEvaluation.summary.recoveryExecutableRate)}
                {health ? ` · ${zh ? '24h复核' : 'checks 24h'} ${health.subjects.find((item) => item.subjectCode === subjectCode)?.checks24h ?? 0}` : ''}
              </span>
              {subjectEvaluation.gate.blockers.length > 0 && <span>{subjectEvaluation.gate.blockers.join(' · ')}</span>}
            </div>
          ))}
        </div>
      )}

      {health && health.recentRuns.length > 0 && (
        <div className="admin-list compact">
          {health.recentRuns.slice(0, 5).map((run) => (
            <div key={run.id}>
              <strong>{zh ? '复核运行' : 'Reconciliation run'} · {run.status}</strong>
              <span>
                {run.trigger} · {new Date(run.startedAt).toLocaleString()}
                {run.completedAt ? ` → ${new Date(run.completedAt).toLocaleString()}` : ''}
              </span>
              {run.errorCode && <span>{run.errorCode}</span>}
            </div>
          ))}
        </div>
      )}

      {error && <p className="form-hint admin-question-supply-error">{error}</p>}
      {notice && <p className="form-hint">{notice}</p>}
      {!loading && items.length === 0 && <p className="form-hint">{zh ? '暂无题源补充计划。' : 'No supply plans yet.'}</p>}
      {items.length > 0 && (
        <div className="admin-list compact">
          {items.slice(0, 8).map((item) => (
            <div key={item.id}>
              <strong>{item.request.subjectCode} · {item.request.source} · {item.status}</strong>
              <span>
                {zh ? '需求/已有' : 'requested/available'}: {item.request.requestedCount}/{item.request.availableCount}
                {' · '}{zh ? '周期' : 'cycle'} {item.requestCycle}
                {' · '}{zh ? '尝试' : 'attempts'} {item.attemptCount}
              </span>
              {item.lastErrorCode && <span>{zh ? '错误' : 'error'}: {item.lastErrorCode}</span>}
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
