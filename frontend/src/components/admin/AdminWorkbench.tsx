import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AdminPrimitiveElement = 'section' | 'article' | 'div';

function mergeClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(' ');
}

type AdminButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
type AdminButtonSize = 'sm' | 'md';

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
};

export function AdminButton({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: AdminButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={mergeClassNames('c-admin-button', `c-admin-button--${variant}`, `c-admin-button--${size}`, className)}
    />
  );
}

export type AdminSubnavItem<Key extends string> = {
  key: Key;
  label: ReactNode;
  detail?: ReactNode;
};

type AdminSubnavProps<Key extends string> = {
  items: Array<AdminSubnavItem<Key>>;
  activeKey: Key;
  ariaLabel: string;
  className?: string;
  onChange: (key: Key) => void;
};

export function AdminSubnav<Key extends string>({
  items,
  activeKey,
  ariaLabel,
  className = '',
  onChange
}: AdminSubnavProps<Key>) {
  const rootClassName = mergeClassNames('admin-subnav c-admin-subnav', className);

  return (
    <nav className={rootClassName} aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={mergeClassNames('c-admin-subnav__button c-admin-control', activeKey === item.key ? 'active' : undefined)}
          aria-current={activeKey === item.key ? 'page' : undefined}
          onClick={() => onChange(item.key)}
        >
          <strong>{item.label}</strong>
          {item.detail !== undefined && <span>{item.detail}</span>}
        </button>
      ))}
    </nav>
  );
}

export type AdminStatsStripItem<Key extends string = string> = {
  key: Key;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  active?: boolean;
  disabled?: boolean;
};

type AdminStatsStripProps<Key extends string = string> = {
  items: Array<AdminStatsStripItem<Key>>;
  ariaLabel: string;
  activeKey?: Key;
  className?: string;
  onSelect?: (key: Key) => void;
};

export function AdminStatsStrip<Key extends string = string>({
  items,
  ariaLabel,
  activeKey,
  className = '',
  onSelect
}: AdminStatsStripProps<Key>) {
  const rootClassName = mergeClassNames('admin-stats-strip c-admin-stat-strip', className);

  return (
    <div className={rootClassName} aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.active ?? activeKey === item.key;
        const content = (
          <>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail !== undefined && <small>{item.detail}</small>}
          </>
        );

        if (onSelect) {
          return (
            <button
              key={item.key}
              type="button"
              className={mergeClassNames('c-admin-stat-strip__item c-admin-stat-strip__button c-admin-control', isActive ? 'active' : undefined)}
              aria-pressed={isActive}
              disabled={item.disabled}
              onClick={() => onSelect(item.key)}
            >
              {content}
            </button>
          );
        }

        return (
          <article key={item.key} className="c-admin-stat-strip__item">
            {content}
          </article>
        );
      })}
    </div>
  );
}

export type AdminWorkflowStep = {
  key: string;
  label: ReactNode;
  detail?: ReactNode;
  state?: 'upcoming' | 'active' | 'complete' | 'warning';
};

type AdminWorkflowStepsProps = {
  items: AdminWorkflowStep[];
  ariaLabel: string;
  className?: string;
};

export function AdminWorkflowSteps({ items, ariaLabel, className = '' }: AdminWorkflowStepsProps) {
  return (
    <ol className={mergeClassNames('c-admin-workflow-steps', className)} aria-label={ariaLabel}>
      {items.map((item, index) => (
        <li key={item.key} data-state={item.state ?? 'upcoming'}>
          <span aria-hidden="true">{index + 1}</span>
          <div>
            <strong>{item.label}</strong>
            {item.detail !== undefined && <small>{item.detail}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

type AdminPanelProps = {
  as?: AdminPrimitiveElement;
  children: ReactNode;
  className?: string;
};

export function AdminPanel({ as: Element = 'section', children, className = '' }: AdminPanelProps) {
  return <Element className={mergeClassNames('admin-work-panel c-admin-panel', className)}>{children}</Element>;
}

type AdminPanelHeaderProps = {
  kicker?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function AdminPanelHeader({ kicker, title, actions, children, className = '' }: AdminPanelHeaderProps) {
  return (
    <div className={mergeClassNames('admin-work-panel-heading c-admin-panel-header', className)}>
      <div className="c-admin-panel-header__body">
        {kicker !== undefined && <p className="page-kicker">{kicker}</p>}
        <h2>{title}</h2>
        {children}
      </div>
      {actions && <div className="c-admin-panel-header__actions">{actions}</div>}
    </div>
  );
}

type AdminActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function AdminActionBar({ children, className = '' }: AdminActionBarProps) {
  return <div className={mergeClassNames('admin-inline-actions c-admin-action-bar', className)}>{children}</div>;
}

type AdminTableScrollProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTableScroll({ children, className = '' }: AdminTableScrollProps) {
  return <div className={mergeClassNames('admin-table-scroll c-admin-table-scroll', className)}>{children}</div>;
}

type AdminOperationStatusTone = 'neutral' | 'working' | 'warning' | 'danger' | 'success';

type AdminOperationStatusMetric = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  hidden?: boolean;
  tone?: AdminOperationStatusTone;
};

type AdminOperationStatusRecentItem = {
  key: string | number;
  label: ReactNode;
  detail?: ReactNode;
};

type AdminOperationStatusProps = {
  title: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  metrics?: AdminOperationStatusMetric[];
  recentLabel?: ReactNode;
  recent?: AdminOperationStatusRecentItem[];
  tone?: AdminOperationStatusTone;
  className?: string;
};

export function AdminOperationStatus({
  title,
  status,
  action,
  metrics = [],
  recentLabel = '最近任务',
  recent = [],
  tone = 'neutral',
  className = ''
}: AdminOperationStatusProps) {
  const visibleMetrics = metrics.filter((metric) => !metric.hidden);

  return (
    <div className={mergeClassNames('c-admin-operation-status', className)} data-tone={tone}>
      <div className="c-admin-operation-status__head">
        <strong>{title}</strong>
        {(status !== undefined || action !== undefined) && (
          <span>
            {status}
            {status !== undefined && action !== undefined ? ' · ' : ''}
            {action}
          </span>
        )}
      </div>
      {visibleMetrics.length > 0 && (
        <div className="c-admin-operation-status__metrics">
          {visibleMetrics.map((metric) => (
            <span key={metric.key} data-tone={metric.tone ?? 'neutral'}>
              {metric.label} {metric.value}
            </span>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <p className="c-admin-operation-status__recent">
          {recentLabel}：
          {recent.map((item) => (
            <span key={item.key}>
              {item.label}
              {item.detail !== undefined ? <> · {item.detail}</> : null}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
