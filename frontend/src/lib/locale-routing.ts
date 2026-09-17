import { DEFAULT_LOCALE, getLocaleOption, normalizeLocale, type Locale } from '../i18n/locales';
import { routes } from './routes';

export const LOCALE_ROUTE_PREFIXES: Record<Locale, string> = {
  'zh-CN': 'zh',
  en: 'en',
  th: 'th',
  vi: 'vi',
  ko: 'ko',
  id: 'id',
  fr: 'fr',
  de: 'de',
  ru: 'ru'
};

const PREFIX_TO_LOCALE = new Map(
  Object.entries(LOCALE_ROUTE_PREFIXES).map(([locale, prefix]) => [prefix, locale as Locale])
);

function splitPathSearchHash(path: string) {
  const hashIndex = path.indexOf('#');
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  return { pathname: pathname || routes.home, search, hash };
}

export function localeToRoutePrefix(locale: Locale) {
  return LOCALE_ROUTE_PREFIXES[locale] ?? LOCALE_ROUTE_PREFIXES[DEFAULT_LOCALE];
}

export function localeFromRoutePrefix(prefix: string | undefined) {
  if (!prefix) return null;
  const locale = PREFIX_TO_LOCALE.get(prefix.toLowerCase());
  if (!locale) return null;
  return getLocaleOption(locale).enabled ? locale : null;
}

export function parseLocalizedPath(pathname: string) {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = normalizedPathname.split('/');
  const locale = localeFromRoutePrefix(segments[1]);
  if (!locale) {
    return { locale: null, route: normalizedPathname || routes.home };
  }
  const route = `/${segments.slice(2).join('/')}`.replace(/\/+$/, '') || routes.home;
  return { locale, route };
}

export function stripLocaleFromPath(path: string) {
  const { pathname, search, hash } = splitPathSearchHash(path);
  const parsed = parseLocalizedPath(pathname);
  return `${parsed.route}${search}${hash}`;
}

export function buildLocalizedPath(locale: Locale, internalPath: string) {
  const { pathname, search, hash } = splitPathSearchHash(stripLocaleFromPath(internalPath));
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutTrailingSlash = normalizedPathname === routes.home ? '' : normalizedPathname.replace(/\/+$/, '');
  return `/${localeToRoutePrefix(locale)}${withoutTrailingSlash}${search}${hash}`;
}

export function getLocaleFromPathname(pathname: string) {
  return parseLocalizedPath(pathname).locale;
}
