import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LEGACY_LOCALE_SOURCE_STORAGE_KEY,
  LEGACY_LOCALE_STORAGE_KEY,
  LOCALE_SOURCE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  getLocaleOption,
  normalizeLocale,
  type Locale,
  type LocaleOption
} from './locales';
import { readMessage } from './messages';

type I18nContextValue = {
  locale: Locale;
  localeOption: LocaleOption;
  locales: LocaleOption[];
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale(): Locale {
  const languages = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  return languages.some((language) => language?.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en';
}

function detectInitialLocale(): Locale {
  const currentLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const legacyLocale = window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  const currentSource = window.localStorage.getItem(LOCALE_SOURCE_STORAGE_KEY);
  const legacySource = window.localStorage.getItem(LEGACY_LOCALE_SOURCE_STORAGE_KEY);
  if (!currentLocale && legacyLocale) window.localStorage.setItem(LOCALE_STORAGE_KEY, legacyLocale);
  if (!currentSource && legacySource) window.localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, legacySource);
  if (legacyLocale) window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
  if (legacySource) window.localStorage.removeItem(LEGACY_LOCALE_SOURCE_STORAGE_KEY);

  const queryLocale = normalizeLocale(new URLSearchParams(window.location.search).get('lang'));
  if (queryLocale) return queryLocale;

  const storedLocale = normalizeLocale(currentLocale || legacyLocale);
  const storedSource = currentSource || legacySource;
  if (storedLocale && storedSource === 'manual' && getLocaleOption(storedLocale).enabled) {
    return storedLocale;
  }

  return detectBrowserLocale() ?? DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hadQueryLocale = search.has('lang');
    if (hadQueryLocale) search.delete('lang');
    const cleanSearch = search.toString() ? `?${search.toString()}` : '';
    const isStandaloneDocument = /\/[^/]+\.html$/i.test(window.location.pathname);
    if (isStandaloneDocument) {
      if (hadQueryLocale) window.history.replaceState(window.history.state, '', `${window.location.pathname}${cleanSearch}${window.location.hash}`);
      return;
    }
    if (hadQueryLocale) window.history.replaceState(window.history.state, '', `${window.location.pathname}${cleanSearch}${window.location.hash}`);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    const option = getLocaleOption(nextLocale);
    if (!option.enabled) return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, 'manual');
    window.localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_LOCALE_SOURCE_STORAGE_KEY);
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    localeOption: getLocaleOption(locale),
    locales: SUPPORTED_LOCALES,
    setLocale,
    t: (key, fallback) => readMessage(locale, key) ?? fallback ?? key
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
