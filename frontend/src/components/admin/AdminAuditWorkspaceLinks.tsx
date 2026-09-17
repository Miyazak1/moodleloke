import type { ReactNode } from 'react';

type AdminAuditWorkspaceAction = {
  key: string;
  label: ReactNode;
  onClick?: () => void;
};

type AdminAuditWorkspaceAnchor = {
  key: string;
  label: ReactNode;
  href: string;
};

type AdminAuditWorkspaceLinksProps = {
  actions: AdminAuditWorkspaceAction[];
  anchors?: AdminAuditWorkspaceAnchor[];
  ariaLabel?: string;
  variant?: 'hero' | 'nav';
};

export function AdminAuditWorkspaceLinks({
  actions,
  anchors = [],
  ariaLabel,
  variant = 'nav'
}: AdminAuditWorkspaceLinksProps) {
  const enabledActions = actions.filter((action) => action.onClick);
  if (enabledActions.length === 0 && anchors.length === 0) return null;

  if (variant === 'hero') {
    return (
      <div className="admin-work-hero-actions">
        {enabledActions.map((action) => (
          <button key={action.key} type="button" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
        {anchors.map((anchor) => (
          <a key={anchor.key} href={anchor.href}>
            {anchor.label}
          </a>
        ))}
      </div>
    );
  }

  return (
    <nav className="admin-page-jump-nav" aria-label={ariaLabel}>
      {enabledActions.map((action) => (
        <button key={action.key} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      {anchors.map((anchor) => (
        <a key={anchor.key} href={anchor.href}>
          {anchor.label}
        </a>
      ))}
    </nav>
  );
}
