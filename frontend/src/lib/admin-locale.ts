export type AdminLocalizedText = {
  zh: string;
  en: string;
  vi?: string;
};

/**
 * Admin pages still have some copy catalogs that predate Vietnamese support.
 * Keep the locale decision in one place: Vietnamese uses an explicit string
 * when supplied and otherwise falls back to English, never silently to Chinese.
 */
export function adminText(locale: string, text: AdminLocalizedText) {
  if (locale === 'zh-CN') return text.zh;
  if (locale === 'vi') return text.vi ?? text.en;
  return text.en;
}

export function usesLatinAdminCopy(locale: string) {
  return locale !== 'zh-CN';
}

export function selectAdminCopy<T>(locale: string, catalogs: { zh: T; en: T; vi?: T }) {
  if (locale === 'zh-CN') return catalogs.zh;
  if (locale === 'vi' && catalogs.vi) return catalogs.vi;
  return catalogs.en;
}
