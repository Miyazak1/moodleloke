import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 190, placement: 'bottom' as 'top' | 'bottom' });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = locale === 'zh-CN' ? '界面语言' : locale === 'vi' ? 'Ngôn ngữ giao diện' : 'Interface language';
  const enabledLocales = locales.filter((option) => option.enabled);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) return;

    const positionMenu = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportGap = 12;
      const menuGap = 9;
      const width = Math.min(Math.max(trigger.width, 190), window.innerWidth - viewportGap * 2);
      const menuHeight = menuRef.current?.offsetHeight ?? (enabledLocales.length * 44 + 14);
      const spaceBelow = window.innerHeight - trigger.bottom - viewportGap;
      const placement = spaceBelow >= menuHeight + menuGap || trigger.top < menuHeight + menuGap + viewportGap ? 'bottom' : 'top';
      const preferredLeft = trigger.right - width;
      const left = Math.min(Math.max(viewportGap, preferredLeft), window.innerWidth - width - viewportGap);
      const top = placement === 'bottom'
        ? Math.min(trigger.bottom + menuGap, window.innerHeight - menuHeight - viewportGap)
        : Math.max(viewportGap, trigger.top - menuHeight - menuGap);
      setMenuPosition({ top, left, width, placement });
    };

    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [enabledLocales.length, open]);

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
      {open ? createPortal(
        <div
          ref={menuRef}
          className={`language-selector-menu is-portal opens-${menuPosition.placement}`}
          role="listbox"
          aria-label={label}
          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
        >
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
              {option.code === locale ? <Icon name="lucide:check" /> : null}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
