import { Icon } from '../Icon';

type AgentAsyncStateProps = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const STATE_ICON = {
  loading: 'lucide:loader-circle',
  error: 'lucide:circle-alert',
  empty: 'lucide:inbox'
} as const;

export function AgentAsyncState({ kind, title, body, actionLabel, onAction }: AgentAsyncStateProps) {
  return (
    <section
      className={`agent-async-state is-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      aria-busy={kind === 'loading' ? true : undefined}
    >
      <span className="agent-async-state-icon" aria-hidden="true"><Icon name={STATE_ICON[kind]} /></span>
      <div>
        <strong>{title}</strong>
        {body ? <p>{body}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          <Icon name="lucide:refresh-cw" />{actionLabel}
        </button>
      ) : null}
    </section>
  );
}
