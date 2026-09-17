import { DEFAULT_LOCALE, type Locale } from './locales';

const REQUIRED_LOCALE = 'zh-CN';
const SECONDARY_FALLBACK_LOCALE = 'en';

export type LocalizedMap<T> = Partial<Record<Locale, T>> & Record<'zh-CN', T>;

export type TranslationMeta = {
  requestedLocale: Locale;
  resolvedLocale: Locale;
  isFallback: boolean;
};

export function pickLocalized<T>(
  value: LocalizedMap<T>,
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE
): T {
  return value[locale]
    ?? (locale === REQUIRED_LOCALE ? undefined : value[SECONDARY_FALLBACK_LOCALE])
    ?? value[fallbackLocale]
    ?? value[REQUIRED_LOCALE];
}

export function resolveLocalized<T>(
  value: LocalizedMap<T>,
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE
): { value: T; meta: TranslationMeta } {
  const resolvedLocale = value[locale] !== undefined
    ? locale
    : locale !== REQUIRED_LOCALE && value[SECONDARY_FALLBACK_LOCALE] !== undefined
      ? SECONDARY_FALLBACK_LOCALE
      : value[fallbackLocale] !== undefined
        ? fallbackLocale
        : DEFAULT_LOCALE;
  return {
    value: value[resolvedLocale] ?? value[REQUIRED_LOCALE],
    meta: {
      requestedLocale: locale,
      resolvedLocale,
      isFallback: resolvedLocale !== locale
    }
  };
}

export function pickLocalizedString(
  value: Partial<Record<Locale, string | null | undefined>>,
  locale: Locale,
  fallback = '',
  fallbackLocale: Locale = DEFAULT_LOCALE
): string {
  return cleanString(value[locale])
    ?? (locale === REQUIRED_LOCALE ? undefined : cleanString(value[SECONDARY_FALLBACK_LOCALE]))
    ?? cleanString(value[fallbackLocale])
    ?? cleanString(value[DEFAULT_LOCALE])
    ?? fallback;
}

export function hasLocaleValue<T>(
  value: Partial<Record<Locale, T | null | undefined>>,
  locale: Locale
): boolean {
  return value[locale] !== undefined && value[locale] !== null;
}

export function isLocaleFallback<T>(
  value: Partial<Record<Locale, T | null | undefined>>,
  locale: Locale,
  fallbackLocale: Locale = DEFAULT_LOCALE
): boolean {
  return !hasLocaleValue(value, locale) && hasLocaleValue(value, fallbackLocale);
}

function cleanString(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}
