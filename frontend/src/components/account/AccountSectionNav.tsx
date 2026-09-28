import { useEffect, useRef } from 'react';
import type { AccountSectionKey } from '../../lib/account-url-state';

type AccountSectionNavProps = {
  activeSection: AccountSectionKey;
  ariaLabel: string;
  labels: Record<AccountSectionKey, string>;
  navMeta: Record<AccountSectionKey, number | null>;
  sections: AccountSectionKey[];
  onSelect: (section: AccountSectionKey) => void;
};

export function AccountSectionNav({ activeSection, ariaLabel, labels, navMeta, sections, onSelect }: AccountSectionNavProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const activeButton = wrap?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!wrap || !activeButton || wrap.scrollWidth <= wrap.clientWidth) return;
    wrap.scrollTo({
      left: activeButton.offsetLeft - (wrap.clientWidth - activeButton.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }, [activeSection]);

  return (
    <div ref={wrapRef} className="me-section-nav-wrap">
      <nav className="me-section-nav" aria-label={ariaLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={activeSection === key ? 'active' : ''}
            aria-current={activeSection === key ? 'page' : undefined}
            onClick={() => onSelect(key)}
          >
            <span>{labels[key]}</span>
            {navMeta[key] !== null && navMeta[key] > 0 && <small>{navMeta[key]}</small>}
          </button>
        ))}
      </nav>
    </div>
  );
}

