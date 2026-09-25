import { Icon } from './Icon';
import { useI18n } from '../i18n/useI18n';
import type { Locale } from '../i18n/locales';

type LanguageSelectorProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSelector({ compact = false, className = '' }: LanguageSelectorProps) {
  const { locale, locales, setLocale } = useI18n();
  const label = locale === 'zh-CN' ? '界面语言' : locale === 'vi' ? 'Ngôn ngữ giao diện' : 'Interface language';

  return (
    <label className={['language-selector', compact ? 'is-compact' : '', className].filter(Boolean).join(' ')}>
      <Icon name="lucide:languages" />
      {!compact ? <span>{label}</span> : null}
      <select aria-label={label} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
        {locales.filter((option) => option.enabled).map((option) => (
          <option key={option.code} value={option.code}>{option.nativeName}</option>
        ))}
      </select>
      <Icon name="lucide:chevron-down" />
    </label>
  );
}
