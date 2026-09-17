export type Locale = 'zh-CN' | 'en' | 'th' | 'vi' | 'ko' | 'id' | 'fr' | 'de' | 'ru';

export type LocaleOption = {
  code: Locale;
  shortCode: string;
  label: string;
  nativeName: string;
  enabled: boolean;
};

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'cscalite.locale';
export const LOCALE_SOURCE_STORAGE_KEY = 'cscalite.localeSource';

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'zh-CN', shortCode: 'CN', label: 'Chinese', nativeName: '中文', enabled: true },
  { code: 'en', shortCode: 'GB', label: 'English', nativeName: 'English', enabled: true },
  { code: 'vi', shortCode: 'VN', label: 'Vietnamese', nativeName: 'Tiếng Việt', enabled: true },
  { code: 'th', shortCode: 'TH', label: 'Thai', nativeName: 'ไทย', enabled: false },
  { code: 'ko', shortCode: 'KR', label: 'Korean', nativeName: '한국어', enabled: false },
  { code: 'id', shortCode: 'ID', label: 'Indonesian', nativeName: 'Bahasa Indonesia', enabled: false },
  { code: 'fr', shortCode: 'FR', label: 'French', nativeName: 'Français', enabled: false },
  { code: 'de', shortCode: 'DE', label: 'German', nativeName: 'Deutsch', enabled: false },
  { code: 'ru', shortCode: 'RU', label: 'Russian', nativeName: 'Русский', enabled: false }
];

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.some((locale) => locale.code === value));
}

export function getLocaleOption(locale: Locale) {
  return SUPPORTED_LOCALES.find((item) => item.code === locale) ?? SUPPORTED_LOCALES[0];
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const exact = SUPPORTED_LOCALES.find((item) => item.code.toLowerCase() === value.toLowerCase());
  if (exact) return exact.code;
  const language = value.split('-')[0]?.toLowerCase();
  if (language === 'zh') return 'zh-CN';
  const languageMatch = SUPPORTED_LOCALES.find((item) => item.code.split('-')[0].toLowerCase() === language);
  return languageMatch?.code ?? null;
}
