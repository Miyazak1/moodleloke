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

type WidenCopy<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer Item)[]
        ? ReadonlyArray<WidenCopy<Item>>
        : T extends object
          ? { [Key in keyof T]: WidenCopy<T[Key]> }
          : T;

export type AdminCopy<T> = WidenCopy<T>;

export function selectAdminCopy<Zh, En extends WidenCopy<Zh>, Vi extends WidenCopy<Zh> = WidenCopy<Zh>>(
  locale: string,
  catalogs: { zh: Zh; en: En; vi?: Vi }
): WidenCopy<Zh> {
  if (locale === 'zh-CN') return catalogs.zh as WidenCopy<Zh>;
  if (locale === 'vi' && catalogs.vi) return catalogs.vi;
  return catalogs.en;
}
