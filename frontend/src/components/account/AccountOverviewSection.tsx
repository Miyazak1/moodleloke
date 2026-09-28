import type { AccountAssetSectionKey } from '../../lib/account-url-state';
import type { ReactNode } from 'react';

export type AccountOverviewSummaryItem = {
  key: AccountAssetSectionKey;
  label: string;
  note: string;
  value: number;
};

export type AccountOverviewTaskCard = {
  key: AccountAssetSectionKey;
  body: string;
  meta: string;
  title: string;
  onClick: () => void;
};

type AccountOverviewSectionProps = {
  children?: ReactNode;
  nextAction: {
    body: string;
    label: string;
    title: string;
  };
  nextStepLabel: string;
  prioritySection: AccountAssetSectionKey;
  summaryAriaLabel: string;
  summaryItems: AccountOverviewSummaryItem[];
  taskCards: AccountOverviewTaskCard[];
  onJumpToSection: (section: AccountAssetSectionKey) => void;
  onRunNextAction: () => void;
};

export function AccountOverviewSection({
  children,
  nextAction,
  nextStepLabel,
  prioritySection,
  summaryAriaLabel,
  summaryItems,
  taskCards,
  onJumpToSection,
  onRunNextAction
}: AccountOverviewSectionProps) {
  return (
    <section id="me-overview" className="me-overview-section">
      <section className="me-overview-command-bar">
        <section className="me-next-panel">
          <div>
            <p className="page-kicker">{nextStepLabel}</p>
            <h2>{nextAction.title}</h2>
            <p>{nextAction.body}</p>
          </div>
          <button type="button" onClick={onRunNextAction}>{nextAction.label}</button>
        </section>

        <section className="me-summary-grid me-summary-strip" aria-label={summaryAriaLabel}>
          {summaryItems.map((item) => (
            <button key={item.key} type="button" onClick={() => onJumpToSection(item.key)}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </button>
          ))}
        </section>
      </section>

      <section className="me-task-grid">
        {taskCards.map((task) => (
          <button key={task.key} type="button" className={task.key === prioritySection ? 'me-task-card priority' : 'me-task-card'} onClick={task.onClick}>
            <span>{task.meta}</span>
            <strong>{task.title}</strong>
            <p>{task.body}</p>
          </button>
        ))}
      </section>
      {children}
    </section>
  );
}

