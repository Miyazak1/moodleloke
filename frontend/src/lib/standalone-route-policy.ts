export type StandaloneRoute = 'home' | 'about' | 'csca-prep' | 'agent' | 'auth' | 'onboarding' | 'me' | 'not-found';

export type StandaloneRouteResolution = {
  route: StandaloneRoute;
  pathname: string;
  href: string;
  shouldCanonicalize: boolean;
};

const ROUTE_PATHS = {
  home: '/',
  about: '/about',
  cscaPrep: '/csca-prep',
  agent: '/agent',
  auth: '/auth',
  login: '/login',
  register: '/register',
  onboarding: '/onboarding',
  me: '/me'
} as const;

const POLICY_ORIGIN = 'https://moodlelike.local';

function normalizePathname(value: string) {
  const pathname = value.startsWith('/') ? value : `/${value}`;
  return pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || ROUTE_PATHS.home;
}

function safeSearch(value: string) {
  return value && value.startsWith('?') ? value : '';
}

function safeHash(value: string) {
  return value && value.startsWith('#') ? value : '';
}

function authAliasHref(pathname: string, search: string, hash: string) {
  const params = new URLSearchParams(search);
  if (pathname === ROUTE_PATHS.register) params.set('mode', 'register');
  else if (pathname === ROUTE_PATHS.login) params.delete('mode');
  const query = params.toString();
  return `${ROUTE_PATHS.auth}${query ? `?${query}` : ''}${hash}`;
}

function legacyLearningAliasHref(pathname: string, hash: string) {
  const subjectMatch = pathname.match(/^\/csca-subjects\/(math|physics|chemistry)(?:\/|$)/);
  if (subjectMatch) return `${ROUTE_PATHS.agent}?mode=free&subject=${subjectMatch[1]}${hash}`;
  if (pathname === '/csca-subjects') return `${ROUTE_PATHS.agent}?agentSection=practice${hash}`;
  if (pathname.startsWith('/csca-mock-exam')) return `${ROUTE_PATHS.agent}?agentSection=progress${hash}`;
  if (pathname.startsWith('/past-papers')) return `${ROUTE_PATHS.agent}?agentSection=resources${hash}`;
  if (pathname.startsWith('/csca-special-practice')) return `${ROUTE_PATHS.agent}?agentSection=practice${hash}`;
  return null;
}

export function resolveStandaloneLocation(pathname: string, search = '', hash = ''): StandaloneRouteResolution {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedSearch = safeSearch(search);
  const normalizedHash = safeHash(hash);
  const shouldCanonicalize = normalizedPathname !== pathname;

  const legacyHref = legacyLearningAliasHref(normalizedPathname, normalizedHash);
  if (legacyHref) {
    return {
      route: 'agent',
      pathname: ROUTE_PATHS.agent,
      href: legacyHref,
      shouldCanonicalize: true
    };
  }

  if (normalizedPathname === ROUTE_PATHS.login || normalizedPathname === ROUTE_PATHS.register) {
    return {
      route: 'auth',
      pathname: ROUTE_PATHS.auth,
      href: authAliasHref(normalizedPathname, normalizedSearch, normalizedHash),
      shouldCanonicalize: true
    };
  }
  if (normalizedPathname === ROUTE_PATHS.auth) {
    return { route: 'auth', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.onboarding) {
    return { route: 'onboarding', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.me) {
    return { route: 'me', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.home) {
    return { route: 'home', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.about) {
    return { route: 'about', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.cscaPrep) {
    return { route: 'csca-prep', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  if (normalizedPathname === ROUTE_PATHS.agent) {
    return { route: 'agent', pathname: normalizedPathname, href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`, shouldCanonicalize };
  }
  return {
    route: 'not-found',
    pathname: normalizedPathname,
    href: `${normalizedPathname}${normalizedSearch}${normalizedHash}`,
    shouldCanonicalize
  };
}

export function resolveStandaloneHref(value: string, origin = POLICY_ORIGIN) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) {
    return resolveStandaloneLocation('/404');
  }
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return resolveStandaloneLocation('/404');
  }
  if (url.origin !== new URL(origin).origin) return resolveStandaloneLocation('/404');
  return resolveStandaloneLocation(url.pathname, url.search, url.hash);
}

export function safeStandaloneReturnPath(value: string | null | undefined, fallback = ROUTE_PATHS.agent) {
  const raw = String(value ?? '').trim();
  const safeFallback = (() => {
    const resolved = resolveStandaloneHref(fallback);
    return resolved.route === 'agent' || resolved.route === 'me' ? resolved.href : ROUTE_PATHS.agent;
  })();
  if (!raw || raw.length > 300 || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
  const resolved = resolveStandaloneHref(raw);
  return resolved.route === 'agent' || resolved.route === 'me' ? resolved.href : safeFallback;
}
