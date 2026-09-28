import { useEffect, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { AdminStatsStrip } from '../components/admin/AdminWorkbench';
import { useI18n } from '../i18n/useI18n';
import {
  getAdminAuditEvents,
  getAdminOperationsOverview,
  type AdminAuditEvent,
  type AdminOperationsOverview,
  type User
} from '../lib/api';

type AdminOperationsPageProps = {
  currentUser?: User | null;
  onGoToContent: () => void;
  onGoToAuth: () => void;
};

const COPY = {
  zh: {
    kicker: '后台运营',
    title: 'CSCA 运营概览',
    guestTitle: '运营后台',
    body: '集中查看内容发布、做题训练和学习 Agent 的运行数据。这里只展示已完成权限与数据闭环的模块。',
    guestBody: '请先登录管理员账号后继续。',
    auditEvents: '审计事件',
    contentChanges: '内容变更',
    mockAttempts: '模考作答',
    practiceSessions: '训练会话',
    agentConversations: 'Agent 会话',
    latestEvent: '最近后台操作',
    noLatestEvent: '暂无后台操作记录',
    recentTitle: '最近操作记录',
    recentBody: '记录管理员对内容和运营数据的变更，便于追踪发布与回滚。',
    loading: '正在读取运营数据…',
    loadFailed: '运营数据暂时无法加载，请稍后重试。',
    empty: '暂无审计事件。内容保存或发布后会在这里留下记录。',
    refresh: '刷新',
    actor: '操作人',
    systemActor: '系统',
    resource: '对象',
    eventTime: '时间'
  },
  en: {
    kicker: 'Admin operations',
    title: 'CSCA operations overview',
    guestTitle: 'Operations console',
    body: 'Monitor content publishing, practice activity, and learning Agent usage. Only modules with verified authorization and data boundaries are shown.',
    guestBody: 'Sign in with an administrator account to continue.',
    auditEvents: 'Audit events',
    contentChanges: 'Content changes',
    mockAttempts: 'Mock attempts',
    practiceSessions: 'Practice sessions',
    agentConversations: 'Agent conversations',
    latestEvent: 'Latest admin action',
    noLatestEvent: 'No admin actions yet',
    recentTitle: 'Recent activity',
    recentBody: 'Administrator changes are recorded here to support publishing review and rollback.',
    loading: 'Loading operations data…',
    loadFailed: 'Operations data is temporarily unavailable. Please try again.',
    empty: 'No audit events yet. Saving or publishing content will create a record here.',
    refresh: 'Refresh',
    actor: 'Actor',
    systemActor: 'System',
    resource: 'Resource',
    eventTime: 'Time'
  }
} as const;

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(parsed);
}

export function AdminOperationsPage({ currentUser, onGoToContent, onGoToAuth }: AdminOperationsPageProps) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? COPY.en : COPY.zh;
  const [overview, setOverview] = useState<AdminOperationsOverview | null>(null);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all([getAdminOperationsOverview(), getAdminAuditEvents({ limit: 50 })])
      .then(([nextOverview, response]) => {
        if (!active) return;
        setOverview(nextOverview);
        setEvents(response.items);
      })
      .catch(() => {
        if (active) setError(copy.loadFailed);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [copy.loadFailed, currentUser?.role, reloadKey]);

  const latestEventAt = formatDate(overview?.latestAdminAuditEventAt, locale);

  return (
    <AdminPageShell
      current="audit"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.title : copy.guestTitle}
      body={currentUser?.role === 'admin' ? copy.body : copy.guestBody}
      onGoToAuth={onGoToAuth}
      onGoToContent={onGoToContent}
    >
      {currentUser?.role === 'admin' && (
        <>
          <AdminStatsStrip
            ariaLabel={copy.title}
            className="admin-audit-overview-kpis"
            items={[
              { key: 'audit', label: copy.auditEvents, value: overview?.adminAuditEventCount ?? '—', detail: latestEventAt ? `${copy.latestEvent}：${latestEventAt}` : copy.noLatestEvent },
              { key: 'content', label: copy.contentChanges, value: overview?.contentAuditEventCount ?? '—' },
              { key: 'mock', label: copy.mockAttempts, value: overview?.mockExamAttemptCount ?? '—' },
              { key: 'practice', label: copy.practiceSessions, value: overview?.specialPracticeSessionCount ?? '—' },
              { key: 'agent', label: copy.agentConversations, value: overview?.activeAgentConversationCount ?? '—' }
            ]}
          />

          <section className="process-list admin-compact-section" aria-labelledby="admin-operations-recent-title">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">Audit log</p>
                <h2 id="admin-operations-recent-title">{copy.recentTitle}</h2>
              </div>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={isLoading}>{copy.refresh}</button>
            </div>
            <p>{copy.recentBody}</p>
            {isLoading && !overview && <p role="status">{copy.loading}</p>}
            {error && <p role="alert">{error}</p>}
            {!isLoading && !error && events.length === 0 && <p className="admin-empty-state">{copy.empty}</p>}
            {events.map((event) => (
              <article className="process-row" key={event.id}>
                <div>
                  <strong>{event.module}.{event.action}</strong>
                  <p>{copy.resource}：{event.resourceType}{event.resourceId ? ` #${event.resourceId}` : ''}</p>
                </div>
                <div>
                  <strong>{copy.actor}：{event.actorEmail ?? copy.systemActor}</strong>
                  <p>{copy.eventTime}：{formatDate(event.createdAt, locale)}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
