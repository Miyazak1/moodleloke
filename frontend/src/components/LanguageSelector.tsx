import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/useI18n';
import type { Locale } from '../i18n/locales';

type LanguageSelectorProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSelector({ compact = false, className = '' }: LanguageSelectorProps) {
  const { locale, localeOption, locales, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = locale === 'zh-CN' ? '界面语言' : locale === 'vi' ? 'Ngôn ngữ giao diện' : 'Interface language';
  const enabledLocales = locales.filter((option) => option.enabled);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const chooseLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={['language-selector', compact ? 'is-compact' : '', open ? 'is-open' : '', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="language-selector-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="lucide:languages" />
        {!compact ? <span className="language-selector-label">{label}</span> : null}
        <span className="language-selector-current">{localeOption.nativeName}</span>
        <Icon name="lucide:chevron-down" />
      </button>
      {open ? (
        <div className="language-selector-menu" role="listbox" aria-label={label}>
          {enabledLocales.map((option) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={option.code === locale}
              className={option.code === locale ? 'is-selected' : ''}
              onClick={() => chooseLocale(option.code)}
            >
              <span>{option.nativeName}</span>
              <small>{option.shortCode}</small>
              {option.code === locale ? <Icon name="lucide:check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
