import { useCallback, useEffect, useState } from 'react';
import {
  getAdminInterventionPilotObservability,
  type AdminInterventionPilotObservability
} from '../../lib/api-admin';
import { ApiError } from '../../lib/request';
import { AdminActionBar, AdminPanel, AdminPanelHeader, AdminTableScroll } from './AdminWorkbench';

type Props = { locale: string };

function compactError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

function percent(value: number | null) {
  return value === null ? '-' : `${Math.round(value * 1000) / 10}%`;
}

function label(value: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    stable: ['已形成稳定证据', 'Stable evidence'], blocked: ['资源阻断', 'Resource blocked'],
    collecting: ['证据收集中', 'Collecting evidence'], not_started: ['尚未开始', 'Not started'],
    immediate: ['立即验证', 'Immediate'], retention: ['间隔验证', 'Retention'], transfer: ['迁移验证', 'Transfer'],
    expand_candidate: ['可扩大试点', 'Expansion candidate'], collect_evidence: ['继续收集证据', 'Collect evidence'],
    repair_resources: ['先补资源', 'Repair resources'], pause_quality: ['暂停并检查质量', 'Pause for quality']
  };
  return labels[value]?.[zh ? 0 : 1] ?? value;
}

function gateReasonLabel(code: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    MINIMUM_LEARNERS_NOT_MET: ['学习者样本不足', 'Learner sample too small'],
    MINIMUM_COMPLETED_DELIVERIES_NOT_MET: ['讲解完成样本不足', 'Too few completed lessons'],
    MINIMUM_IMMEDIATE_VERIFICATIONS_NOT_MET: ['立即验证样本不足', 'Too few immediate verifications'],
    MINIMUM_RETENTION_VERIFICATIONS_NOT_MET: ['间隔验证样本不足', 'Too few retention verifications'],
    MINIMUM_TRANSFER_VERIFICATIONS_NOT_MET: ['迁移验证样本不足', 'Too few transfer verifications'],
    MINIMUM_STABILITY_ASSESSMENTS_NOT_MET: ['稳定性样本不足', 'Too few stability assessments'],
    CONTENT_UNAVAILABLE_RATE_ABOVE_CEILING: ['讲解资源缺失率过高', 'Teaching content shortage too high'],
    VERIFICATION_SUPPLY_UNAVAILABLE_RATE_ABOVE_CEILING: ['验证题不足率过高', 'Verification shortage too high'],
    DELIVERY_COMPLETION_RATE_BELOW_FLOOR: ['讲解完成率偏低', 'Teaching completion below floor'],
    IMMEDIATE_PASS_RATE_BELOW_FLOOR: ['立即验证通过率偏低', 'Immediate pass rate below floor'],
    RETENTION_PASS_RATE_BELOW_FLOOR: ['间隔验证通过率偏低', 'Retention pass rate below floor'],
    TRANSFER_PASS_RATE_BELOW_FLOOR: ['迁移验证通过率偏低', 'Transfer pass rate below floor'],
    STABLE_RATE_BELOW_FLOOR: ['稳定掌握率偏低', 'Stable mastery below floor']
  };
  return labels[code]?.[zh ? 0 : 1] ?? code;
}

export function InterventionPilotObservabilityPanel({ locale }: Props) {
  const zh = locale !== 'en';
  const [data, setData] = useState<AdminInterventionPilotObservability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminInterventionPilotObservability({ days }));
    } catch (nextError) {
      setError(compactError(nextError));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminPanel className="admin-intervention-pilot-panel">
      <AdminPanelHeader
        kicker={zh ? '学习 Agent 试点闭环' : 'Learning Agent pilot loop'}
        title={zh ? '讲解与验证漏斗' : 'Teaching and verification funnel'}
        actions={(
          <AdminActionBar>
            <select aria-label={zh ? '统计周期' : 'Reporting window'} value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>{zh ? '近 7 天' : 'Last 7 days'}</option>
              <option value={30}>{zh ? '近 30 天' : 'Last 30 days'}</option>
              <option value={90}>{zh ? '近 90 天' : 'Last 90 days'}</option>
            </select>
            <button type="button" className="ghost-button" disabled={loading} onClick={() => void load()}>
              {loading ? (zh ? '加载中…' : 'Loading…') : (zh ? '刷新' : 'Refresh')}
            </button>
          </AdminActionBar>
        )}
      >
        <p>{zh
          ? '按知识点追踪讲解触达、完成、立即/间隔/迁移验证和稳定掌握；资源不足与用户未开始分开统计。'
          : 'Tracks teaching, immediate/retention/transfer verification and stable mastery by topic, separating resource blockers from learner inactivity.'}</p>
      </AdminPanelHeader>

      {error && <div className="admin-feedback warning"><strong>{zh ? '闭环数据暂时无法加载' : 'Pilot data unavailable'}</strong><p>{error}</p></div>}
      {data && (
        <>
          <div className="metric-grid four">
            <div><span>{zh ? '涉及知识点' : 'Topics'}</span><strong>{data.summary.topicCount}</strong></div>
            <div><span>{zh ? '讲解完成' : 'Teaching completed'}</span><strong>{data.summary.deliveryCompleted}/{data.summary.proposed}</strong></div>
            <div><span>{zh ? '验证通过' : 'Verification passed'}</span><strong>{data.summary.verificationPassed}/{data.summary.verificationCompleted}</strong></div>
            <div><span>{zh ? '稳定掌握' : 'Stable mastery'}</span><strong>{data.summary.stable}</strong></div>
          </div>
          <p className="form-hint">
            {zh ? '资源阻断' : 'Resource blockers'}: {zh ? '缺讲解' : 'teaching'} {data.summary.contentUnavailable}
            {' · '}{zh ? '缺验证题' : 'verification supply'} {data.summary.supplyUnavailable}
            {' · '}{zh ? '证据不足' : 'insufficient evidence'} {data.summary.evidenceInsufficient}
            {' · '}{zh ? '学习者' : 'learners'} {data.summary.learnerCount}
          </p>
          <div className="metric-grid four">
            <div><span>{zh ? '可扩大试点' : 'Expansion candidates'}</span><strong>{data.summary.gateRecommendationCounts.expand_candidate ?? 0}</strong></div>
            <div><span>{zh ? '继续收集' : 'Collect evidence'}</span><strong>{data.summary.gateRecommendationCounts.collect_evidence ?? 0}</strong></div>
            <div><span>{zh ? '需要补资源' : 'Repair resources'}</span><strong>{data.summary.gateRecommendationCounts.repair_resources ?? 0}</strong></div>
            <div><span>{zh ? '质量暂停' : 'Quality pause'}</span><strong>{data.summary.gateRecommendationCounts.pause_quality ?? 0}</strong></div>
          </div>
          <p className="form-hint">{zh ? '准入判断只提供建议，不会自动修改灰度范围。' : 'The gate is advisory and never changes rollout automatically.'}</p>
          <AdminTableScroll>
            <table className="admin-data-table">
              <thead><tr>
                <th>{zh ? '知识点' : 'Topic'}</th><th>{zh ? '状态' : 'Status'}</th><th>{zh ? '讲解漏斗' : 'Teaching funnel'}</th>
                <th>{zh ? '验证阶段' : 'Verification phases'}</th><th>{zh ? '主要阻断' : 'Blockers'}</th>
              </tr></thead>
              <tbody>
                {data.topics.map((topic) => (
                  <tr key={`${topic.subject}:${topic.topicId}`}>
                    <td><strong>{topic.topicCode}</strong><span>{topic.topicTitle} · {topic.learners} {zh ? '人' : 'learners'}</span></td>
                    <td>
                      <strong>{label(topic.gate.recommendation, zh)}</strong>
                      <span>{label(topic.status, zh)} · {zh ? '验证通过率' : 'pass rate'} {percent(topic.rates.verificationPassRate)}</span>
                      {topic.gate.reasonCodes.slice(0, 3).map((code) => <span key={code}>{gateReasonLabel(code, zh)}</span>)}
                    </td>
                    <td><strong>{topic.funnel.proposed} → {topic.funnel.deliveryOffered} → {topic.funnel.deliveryStarted} → {topic.funnel.deliveryCompleted}</strong><span>{zh ? '提出 / 触达 / 开始 / 完成' : 'proposed / offered / started / completed'}</span></td>
                    <td>{topic.phases.map((phase) => <span key={phase.phase}>{label(phase.phase, zh)} {phase.passed}/{phase.completed || 0}</span>)}</td>
                    <td>
                      <strong>{zh ? '内容/题源' : 'content/supply'} {topic.blockers.contentUnavailable}/{topic.blockers.verificationSupplyUnavailable}</strong>
                      <span>{zh ? '未开始' : 'not started'} {topic.blockers.deliveryNotStarted + topic.blockers.verificationNotStarted} · {zh ? '失败' : 'failed'} {topic.blockers.failed} · {zh ? '证据不足' : 'inconclusive'} {topic.blockers.evidenceInsufficient}</span>
                    </td>
                  </tr>
                ))}
                {data.topics.length === 0 && <tr><td colSpan={5}>{zh ? '当前周期内还没有干预样本。' : 'No intervention samples in this window.'}</td></tr>}
              </tbody>
            </table>
          </AdminTableScroll>
        </>
      )}
    </AdminPanel>
  );
}
