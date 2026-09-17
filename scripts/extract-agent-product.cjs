const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..');
const targetRoot = path.resolve(process.argv[2] || 'E:\\CODE\\moodlelike');
const expectedTarget = path.resolve('E:\\CODE\\moodlelike');

if (targetRoot !== expectedTarget) {
  throw new Error(`Refusing to extract outside the approved target: ${targetRoot}`);
}

fs.mkdirSync(targetRoot, { recursive: true });
const existingEntries = fs.readdirSync(targetRoot).filter((name) => name !== '.git');
if (existingEntries.length > 0 && !process.argv.includes('--overwrite')) {
  throw new Error(`Target is not empty: ${existingEntries.join(', ')}. Pass --overwrite only for an intentional refresh.`);
}

const excludedNames = new Set([
  '.git',
  '.env',
  '.local',
  '.tmp',
  'node_modules',
  'dist',
  'test-results',
  'playwright-report',
  'uploads',
  'artifacts',
  'output'
]);

function shouldCopy(source) {
  const relative = path.relative(sourceRoot, source);
  if (!relative) return true;
  return !relative.split(path.sep).some((part) => excludedNames.has(part));
}

function copyEntry(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, target, { recursive: true, filter: shouldCopy, force: true });
}

for (const relativePath of [
  'backend',
  'frontend',
  'scripts',
  'deploy',
  'security',
  'Labs',
  'docs',
  'question-engine',
  'question-production',
  '.dockerignore',
  '.env.example',
  '.env.production.example',
  '.gitignore',
  'docker-compose.yml',
  'package.json',
  'package-lock.json'
]) {
  copyEntry(relativePath);
}

function read(relativePath) {
  return fs.readFileSync(path.join(targetRoot, relativePath), 'utf8');
}

function write(relativePath, content) {
  const target = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.replace(/\r?\n/g, '\r\n'), 'utf8');
}

function replaceRequired(content, searchValue, replacement, label) {
  if (!content.includes(searchValue)) throw new Error(`Required extraction transform not found: ${label}`);
  return content.replace(searchValue, replacement);
}

function updateJson(relativePath, mutate) {
  const value = JSON.parse(read(relativePath));
  mutate(value);
  write(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

updateJson('package.json', (pkg) => {
  pkg.name = 'moodlelike-agent';
  pkg.version = '0.1.0-alpha.3';
  pkg.private = true;
  pkg.description = 'AI-native training and teaching Agent extracted from CSCALite';
  pkg.engines = { node: '>=22 <23' };
  pkg.packageManager = 'npm@10.9.8';
  pkg.scripts.dev = 'npm run local:start';
  pkg.scripts['frontend:dev'] = 'npm --prefix frontend run dev:force -- --port 5190';
  pkg.scripts['local:doctor'] = 'node scripts/moodlelike-local.cjs doctor';
  pkg.scripts['local:setup'] = 'node scripts/moodlelike-local.cjs setup';
  pkg.scripts['local:start'] = 'node scripts/moodlelike-local.cjs start';
  pkg.scripts['local:verify'] = 'node scripts/moodlelike-local.cjs verify';
  pkg.scripts['local:acceptance'] = 'npm run local:verify && npm run security:audit-dependencies && npm run ci:contracts && npm run ci:golden';
  pkg.scripts['demo:seed'] = 'node scripts/agent-demo-seed.cjs --apply';
  pkg.scripts['agent:build'] = 'npm run frontend:build && npm run backend:build';
  pkg.scripts['audit:product-boundaries'] = 'node scripts/audit-product-boundaries.cjs';
  pkg.scripts['test:teaching-assets'] = 'node scripts/check-teaching-asset-registry.cjs';
  pkg.scripts['test:authoring-boundary'] = 'node scripts/check-authoring-boundary.cjs';
  pkg.scripts['test:ci-contract'] = 'node scripts/check-standalone-ci.cjs';
  pkg.scripts['test:local-delivery'] = 'node scripts/check-local-delivery.cjs';
  pkg.scripts['test:data-migration-policy'] = 'node scripts/standalone-data-migration-policy-test.cjs';
  pkg.scripts['test:data-preflight-policy'] = 'node scripts/standalone-data-preflight-policy-test.cjs';
  pkg.scripts['audit:prisma-retention'] = 'node scripts/generate-prisma-retention-matrix.cjs';
  pkg.scripts['data:migrate:plan'] = 'node scripts/standalone-data-migration.cjs';
  pkg.scripts['data:migrate:apply'] = 'node scripts/standalone-data-migration.cjs --apply';
  pkg.scripts['data:rollback:plan'] = 'node scripts/standalone-data-rollback.cjs';
  pkg.scripts['data:rollback:apply'] = 'node scripts/standalone-data-rollback.cjs --apply';
  pkg.scripts['data:rehearsal:plan'] = 'node scripts/phase3b-data-rehearsal.cjs';
  pkg.scripts['data:rehearsal:apply'] = 'node scripts/phase3b-data-rehearsal.cjs --apply';
  pkg.scripts['data:preflight'] = 'node scripts/standalone-data-preflight.cjs';
  pkg.scripts['audit:environment-contract'] = 'node scripts/audit-standalone-environment.cjs';
  pkg.scripts['security:audit-dependencies'] = 'npm audit --prefix backend --audit-level=high && npm audit --prefix frontend --audit-level=high';
  pkg.scripts['release:check'] = 'node scripts/check-release-baseline.cjs';
  pkg.scripts['ci:contracts'] = 'npm run agent:build && npm --prefix backend run test:agent-runtime && npm --prefix frontend run test:minimal && npm --prefix frontend run test:standalone-shell && npm run test:teaching-assets && npm run test:authoring-boundary && npm run test:ci-contract && npm run test:local-delivery && npm run test:data-migration-policy && npm run test:data-preflight-policy && npm --prefix frontend run audit:standalone-reachability && npm run audit:product-boundaries && npm run audit:prisma-retention && npm run audit:environment-contract && npm run release:check';
  pkg.scripts['ci:golden'] = 'npm --prefix frontend run test:e2e:golden';
});

updateJson('package-lock.json', (lock) => {
  lock.name = 'moodlelike-agent';
  lock.version = '0.1.0-alpha.3';
  if (lock.packages?.['']) Object.assign(lock.packages[''], { name: 'moodlelike-agent', version: '0.1.0-alpha.3' });
  for (const item of Object.values(lock.packages || {})) {
    if (item?.name === '@cscalite/backend') item.name = '@moodlelike/backend';
    if (item?.name === '@cscalite/frontend') item.name = '@moodlelike/frontend';
    if (item?.name === 'cscalite-rebuild') item.name = 'moodlelike-agent';
  }
});

updateJson('backend/package.json', (pkg) => {
  pkg.name = '@moodlelike/backend';
  pkg.version = '0.1.0-alpha.3';
  pkg.private = true;
  pkg.engines = { node: '>=22 <23' };
  pkg.scripts.build = 'node scripts/clean-dist.cjs && npm run prisma:generate && nest build';
  pkg.scripts['start:prod'] = 'node dist/backend/src/main.js';
});
updateJson('backend/package-lock.json', (lock) => {
  lock.name = '@moodlelike/backend';
  lock.version = '0.1.0-alpha.3';
  if (lock.packages?.['']) Object.assign(lock.packages[''], { name: '@moodlelike/backend', version: '0.1.0-alpha.3' });
  for (const item of Object.values(lock.packages || {})) { if (item?.name === 'cscalite-rebuild') item.name = 'moodlelike-agent'; if (item?.name === '@cscalite/frontend') item.name = '@moodlelike/frontend'; }
});

updateJson('frontend/package.json', (pkg) => {
  pkg.name = '@moodlelike/frontend';
  pkg.version = '0.1.0-alpha.3';
  pkg.private = true;
  pkg.engines = { node: '>=22 <23' };
  pkg.scripts['test:minimal'] = 'node scripts/test-standalone-minimal.cjs';
  pkg.scripts['test:standalone-shell'] = 'node scripts/check-standalone-agent-shell.cjs';
  pkg.scripts['audit:standalone-reachability'] = 'node scripts/audit-standalone-reachability.cjs';
  pkg.scripts['test:e2e:golden:student'] = 'playwright test e2e/agent-runtime.spec.ts --config playwright.golden.config.ts --grep "creates the recommended practice"';
  pkg.scripts['test:e2e:golden:teaching'] = 'playwright test e2e/agent-runtime.spec.ts --config playwright.golden.config.ts --grep "keeps active practice mounted"';
  pkg.scripts['test:e2e:golden:authoring'] = 'playwright test e2e/authoring-golden.spec.ts --config playwright.golden.config.ts';
  pkg.scripts['test:e2e:golden'] = 'npm run test:e2e:golden:student && npm run test:e2e:golden:teaching && npm run test:e2e:golden:authoring';
});
updateJson('frontend/package-lock.json', (lock) => {
  lock.name = '@moodlelike/frontend';
  lock.version = '0.1.0-alpha.3';
  if (lock.packages?.['']) Object.assign(lock.packages[''], { name: '@moodlelike/frontend', version: '0.1.0-alpha.3' });
  for (const item of Object.values(lock.packages || {})) { if (item?.name === 'cscalite-rebuild') item.name = 'moodlelike-agent'; if (item?.name === '@cscalite/backend') item.name = '@moodlelike/backend'; }
});

updateJson('question-engine/package.json', (pkg) => {
  pkg.name = '@moodlelike/question-engine';
  pkg.version = '0.1.0-alpha.3';
  pkg.private = true;
  pkg.engines = { node: '>=22 <23' };
});

for (const envFile of ['.env.example', '.env.production.example']) {
  let envText = read(envFile);
  envText = envText
    .replace('Database used by Prisma migrations, admin operations, and commerce checks.', 'Moodlelike runtime database used by Prisma migrations and Agent services.')
    .replaceAll('admin@cscalite.local', 'admin@moodlelike.local')
    .replaceAll('https://www.cscalite.com,https://admin.cscalite.com', 'https://app.moodlelike.example,https://authoring.moodlelike.example')
    .replaceAll('cscalite-verify-db-1', 'moodlelike-verify-db-1')
    .replaceAll('cscalite-verify', 'moodlelike-verify')
    .replaceAll('cscalite-example.dump', 'moodlelike-example.dump');
  write(envFile, '# Moodlelike standalone environment template. CSCA/CSCALITE prefixes remain compatibility contracts until a versioned rename.\n' + envText);
}

let questionEngineReadme = read('question-engine/README.md');
questionEngineReadme = questionEngineReadme.replaceAll('@cscalite/question-engine', '@moodlelike/question-engine').replaceAll('inside CSCALite', 'inside the extracted Moodlelike workspace');
write('question-engine/README.md', questionEngineReadme);

let demoSeed = read('scripts/agent-demo-seed.cjs')
  .replaceAll('agent-investor-demo@cscalite.local', 'agent-demo@moodlelike.local')
  .replaceAll('CSCAPilot student answer demo', 'Moodlelike Agent student answer demo');
write('scripts/agent-demo-seed.cjs', demoSeed);

let healthController = read('backend/src/health/health.controller.ts')
  .replaceAll("service: 'cscalite-backend'", "service: 'moodlelike-backend'");
write('backend/src/health/health.controller.ts', healthController);

let backendDevStarter = read('backend/scripts/start-dev.cjs')
  .replaceAll("health?.service === 'cscalite-backend'", "health?.service === 'moodlelike-backend'")
  .replaceAll('CSCAlite backend is already running', 'Moodlelike backend is already running');
write('backend/scripts/start-dev.cjs', backendDevStarter);

const reducedAppModule = `import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { CscaMockExamModule } from './csca-mock-exam/csca-mock-exam.module';
import { CscaSpecialPracticeModule } from './csca-special-practice/csca-special-practice.module';
import { HealthModule } from './health/health.module';
import { LearningIntelligenceFoundationModule } from './learning-intelligence/learning-intelligence-foundation.module';
import { MeModule } from './me/me.module';
import { PastPapersModule } from './past-papers/past-papers.module';

@Module({
  imports: [
    AuthModule,
    MeModule,
    CscaSpecialPracticeModule,
    CscaMockExamModule,
    PastPapersModule,
    LearningIntelligenceFoundationModule,
    AgentModule,
    HealthModule
  ]
})
export class AppModule {}
`;
write('backend/src/app.module.ts', reducedAppModule);

write('backend/scripts/clean-dist.cjs', `const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const distRoot = path.join(backendRoot, 'dist');
fs.rmSync(distRoot, { recursive: true, force: true });
`);
fs.rmSync(path.join(targetRoot, 'backend', 'scripts', 'normalize-dist-layout.cjs'), { force: true });

for (const fileName of fs.readdirSync(path.join(targetRoot, 'backend', 'scripts'))) {
  if (!fileName.endsWith('.cjs')) continue;
  const relativePath = path.join('backend', 'scripts', fileName);
  const original = read(relativePath);
  const updated = original.replaceAll("../dist/", "../dist/backend/src/");
  if (updated !== original) write(relativePath, updated);
}

write('frontend/src/StandaloneAgentApp.tsx', `import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBanner } from './components/ErrorBanner';
import { useI18n } from './i18n/useI18n';
import type { User } from './lib/api';
import { buildAuthRedirectUrl, buildOnboardingUrl } from './lib/app-navigation';
import { buildLocalizedPath, parseLocalizedPath, stripLocaleFromPath } from './lib/locale-routing';
import { EMAIL_UNVERIFIED_EVENT } from './lib/request';
import { routes } from './lib/routes';
import { useAuthSession } from './lib/use-auth-session';

const AgentPage = lazy(() => import('./pages/AgentPage').then((module) => ({ default: module.AgentPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));
const StandaloneAccountPage = lazy(() => import('./pages/StandaloneAccountPage').then((module) => ({ default: module.StandaloneAccountPage })));
const StudentOnboardingPage = lazy(() => import('./pages/StudentOnboardingPage').then((module) => ({ default: module.StudentOnboardingPage })));

type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me';

function readStandaloneRoute(): StandaloneRoute {
  const route = parseLocalizedPath(window.location.pathname).route;
  if (route === routes.auth || route === routes.login || route === routes.register) return 'auth';
  if (route === routes.onboarding) return 'onboarding';
  if (route === routes.me) return 'me';
  return 'agent';
}

function canonicalPath(route: StandaloneRoute) {
  if (route === 'auth') return routes.auth;
  if (route === 'onboarding') return routes.onboarding;
  if (route === 'me') return routes.me;
  return routes.agent;
}

export default function StandaloneAgentApp() {
  const { locale, setLocale } = useI18n();
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const [route, setRoute] = useState<StandaloneRoute>(() => readStandaloneRoute());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentLocale = parseLocalizedPath(window.location.pathname).locale;
    if (currentLocale && currentLocale !== locale) setLocale(currentLocale);
    const currentRoute = readStandaloneRoute();
    const internalPath = stripLocaleFromPath(window.location.pathname);
    if (currentRoute === 'agent' && internalPath !== routes.agent) {
      window.history.replaceState(window.history.state, '', buildLocalizedPath(currentLocale || locale, routes.agent));
    }
    setRoute(currentRoute);
  }, [locale, setLocale]);

  useEffect(() => {
    const handlePopState = () => setRoute(readStandaloneRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleEmailUnverified = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setError(detail?.message || '请先验证邮箱后继续使用。');
    };
    window.addEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
    return () => window.removeEventListener(EMAIL_UNVERIFIED_EVENT, handleEmailUnverified);
  }, []);

  function navigate(next: string) {
    const nextUrl = new URL(next, window.location.origin);
    const internalPath = stripLocaleFromPath(nextUrl.pathname);
    let nextRoute: StandaloneRoute = 'agent';
    if (internalPath === routes.auth || internalPath === routes.login || internalPath === routes.register) nextRoute = 'auth';
    else if (internalPath === routes.onboarding) nextRoute = 'onboarding';
    else if (internalPath === routes.me) nextRoute = 'me';
    const localizedPath = buildLocalizedPath(locale, canonicalPath(nextRoute));
    window.history.pushState({}, '', localizedPath + nextUrl.search + nextUrl.hash);
    window.dispatchEvent(new Event('cscalite:navigation'));
    setRoute(nextRoute);
  }

  function completeAuth(user: User, redirectTo?: string, isRegistration = false) {
    setCurrentUser(user);
    setIsResolvingAuth(false);
    if (isRegistration && user.role !== 'admin') {
      navigate(buildOnboardingUrl(redirectTo || routes.agent));
      return;
    }
    navigate(redirectTo || routes.agent);
  }

  const isAgent = route === 'agent';
  return (
    <div className={isAgent ? 'site-shell site-shell-agent' : 'site-shell'}>
      <main className={isAgent ? 'site-main site-main-agent' : 'site-main'}>
        <ErrorBanner message={error} />
        <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
          {route === 'agent' && (
            <AgentPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onNavigate={navigate}
              onAuthRedirect={(returnTo) => navigate(buildAuthRedirectUrl(returnTo))}
            />
          )}
          {route === 'auth' && (
            <PublicAuthPage
              initialMode={parseLocalizedPath(window.location.pathname).route === routes.register ? 'register' : 'login'}
              redirectTo={new URLSearchParams(window.location.search).get('redirect') ?? undefined}
              onBackHome={() => navigate(routes.agent)}
              onGoToMe={completeAuth}
            />
          )}
          {route === 'onboarding' && (
            <StudentOnboardingPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              returnTo={new URLSearchParams(window.location.search).get('returnTo') ?? routes.agent}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
          {route === 'me' && (
            <StandaloneAccountPage
              currentUser={currentUser}
              isResolvingAuth={isResolvingAuth}
              onCurrentUserChange={setCurrentUser}
              onNavigate={navigate}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
`);

write('frontend/src/pages/StandaloneAccountPage.tsx', `import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/UserAvatar';
import { useI18n } from '../i18n/useI18n';
import type { MyAICredits, User } from '../lib/api-types';
import { acceptOrganizationInvite, acceptOrganizationInviteCode, getMyAICredits } from '../lib/api-me';
import { getMe, logout, resendEmailVerification, updateMeProfile } from '../lib/auth';
import { routes } from '../lib/routes';
import '../styles/standalone-account.css';

type Props = {
  currentUser: User | null;
  isResolvingAuth: boolean;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
};

function inviteValue(value: string) {
  const text = value.trim();
  if (!text) return '';
  try {
    const url = new URL(text, window.location.origin);
    return url.searchParams.get('token')?.trim() || text;
  } catch {
    return text;
  }
}

function isShortCode(value: string) {
  return /^[2-9A-HJ-NP-Z]{8,12}$/.test(value.replace(/[\\s-]+/g, '').toUpperCase());
}

export function StandaloneAccountPage({ currentUser, isResolvingAuth, onCurrentUserChange, onNavigate }: Props) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [credits, setCredits] = useState<MyAICredits | null>(null);
  const [invite, setInvite] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setDisplayName(currentUser?.displayName || ''), [currentUser?.displayName]);

  useEffect(() => {
    if (!currentUser) return;
    let current = true;
    void getMyAICredits().then((value) => {
      if (current) setCredits(value);
    }).catch(() => {
      if (current) setCredits(null);
    });
    return () => { current = false; };
  }, [currentUser?.id]);

  if (isResolvingAuth) return <div className="standalone-account-state" role="status">{t('me.common.loading', '正在读取账号…')}</div>;
  if (!currentUser) {
    return <div className="standalone-account-state"><h1>{t('me.auth.title', '登录后管理个人设置')}</h1><button type="button" onClick={() => onNavigate(routes.auth)}>{t('agent.auth.action', '登录并进入')}</button></div>;
  }

  const organizationName = credits?.organization?.name || credits?.organizationOptions?.find((item) => item.current)?.name || t('me.settings.noOrganization', '未加入机构');
  const creditLabel = credits ? (credits.unlimited ? t('me.credit.unlimited', '不限') : String(credits.balanceUnits ?? 0)) : t('me.common.notLoaded', '暂未读取');

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || name.length > 40) {
      setStatus(t('me.status.displayNameInvalid', '显示名需要 1-40 个字符。'));
      return;
    }
    setPending('profile');
    try {
      await updateMeProfile({ displayName: name });
      const user = await getMe();
      onCurrentUserChange(user);
      setStatus(t('me.status.displayNameUpdated', '显示名已更新。'));
    } catch {
      setStatus(t('me.status.displayNameSaveFailed', '显示名暂时无法保存。'));
    } finally {
      setPending(null);
    }
  }

  async function resendVerification() {
    setPending('verification');
    try {
      const result = await resendEmailVerification();
      setStatus(result.alreadyVerified ? t('me.status.emailAlreadyVerified', '邮箱已经完成验证。') : t('me.status.verificationSent', '验证邮件已发送，请检查收件箱。'));
    } catch {
      setStatus(t('me.status.verificationSendFailed', '验证邮件暂时无法发送。'));
    } finally {
      setPending(null);
    }
  }

  async function joinOrganization(event: FormEvent) {
    event.preventDefault();
    const token = inviteValue(invite);
    if (!token) {
      setStatus(t('me.status.inviteRequired', '请输入机构邀请码、邀请链接或 token。'));
      return;
    }
    setPending('organization');
    try {
      const result = isShortCode(token) ? await acceptOrganizationInviteCode(token) : await acceptOrganizationInvite(token);
      setInvite('');
      setStatus(t('me.status.joinedOrganization', '已加入 {name}。').replace('{name}', result.organization.name));
      setCredits(await getMyAICredits());
    } catch {
      setStatus(t('me.status.inviteFailed', '机构邀请码暂时无法使用。'));
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    setPending('logout');
    await logout();
    onCurrentUserChange(null);
    onNavigate(routes.agent);
  }

  return (
    <div className="standalone-account-page">
      <header className="standalone-account-header">
        <button type="button" className="back" onClick={() => onNavigate(routes.agent)}><Icon name="lucide:arrow-left" color="currentColor" />{t('agent.account.back', '返回学习 Agent')}</button>
        <div><p>{t('agent.account.kicker', '个人设置')}</p><h1>{t('agent.account.title', '账号与机构')}</h1><span>{t('agent.account.body', '这里只管理你的身份、登录和机构关系；学习目标与学习方式在 Agent 的学习设置中管理。')}</span></div>
      </header>

      {status && <div className="standalone-account-status" role="status">{status}</div>}

      <div className="standalone-account-grid">
        <section className="standalone-account-card profile">
          <div className="identity"><UserAvatar displayName={currentUser.displayName} email={currentUser.email} /><div><strong>{currentUser.displayName || currentUser.email}</strong><span>{currentUser.email}</span></div></div>
          <form onSubmit={(event) => void saveProfile(event)}>
            <label><span>{t('me.settings.displayName', '显示名')}</span><input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <button type="submit" disabled={pending === 'profile'}>{pending === 'profile' ? t('me.common.saving', '保存中…') : t('me.actions.saveAccount', '保存账号资料')}</button>
          </form>
        </section>

        <section className="standalone-account-card">
          <header><Icon name={currentUser.emailVerifiedAt ? 'lucide:badge-check' : 'lucide:mail-warning'} color="currentColor" /><div><h2>{t('agent.account.security', '登录与验证')}</h2><p>{currentUser.emailVerifiedAt ? t('me.profile.emailVerified', '邮箱已验证') : t('me.profile.emailUnverified', '邮箱未验证')}</p></div></header>
          <div className="actions">{!currentUser.emailVerifiedAt && <button type="button" onClick={() => void resendVerification()} disabled={pending === 'verification'}>{t('me.actions.resendVerification', '重新发送验证邮件')}</button>}<button type="button" className="secondary" onClick={() => onNavigate(routes.auth + '?mode=forgot')}>{t('auth.forgotPassword', '重置密码')}</button></div>
        </section>

        <section className="standalone-account-card organization">
          <header><Icon name="lucide:building-2" color="currentColor" /><div><h2>{t('me.settings.organizationTitle', '机构与 AI 额度')}</h2><p>{organizationName}</p></div><strong className="credit">{creditLabel}</strong></header>
          <form onSubmit={(event) => void joinOrganization(event)}><input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder={t('me.settings.invitePlaceholder', '粘贴邀请链接、token 或短邀请码')} /><button type="submit" disabled={pending === 'organization'}>{pending === 'organization' ? t('me.common.joining', '加入中…') : t('me.actions.joinOrganization', '加入机构')}</button></form>
        </section>

        <section className="standalone-account-card boundary">
          <Icon name="lucide:sliders-horizontal" color="currentColor" /><div><h2>{t('agent.account.learningSettings', '学习设置留在 Agent')}</h2><p>{t('agent.account.learningSettingsBody', '学习模式、目标、科目、语言和时间容量会改变 Agent 决策，因此统一在学习工作区维护。')}</p><button type="button" className="secondary" onClick={() => onNavigate(routes.agent)}>{t('agent.account.openLearningSettings', '返回 Agent 设置')}</button></div>
        </section>
      </div>

      <footer className="standalone-account-footer"><button type="button" className="danger" disabled={pending === 'logout'} onClick={() => void signOut()}>{t('header.logout', '退出登录')}</button></footer>
    </div>
  );
}
`);

write('frontend/src/styles/standalone-account.css', `.standalone-account-page{min-height:100vh;padding:clamp(24px,5vw,72px);background:#f7faf8;color:#14213d}.standalone-account-header{max-width:1080px;margin:0 auto 28px}.standalone-account-header .back{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#31506b;padding:8px 0;cursor:pointer}.standalone-account-header>div{margin-top:28px}.standalone-account-header p{margin:0 0 8px;color:#265dff;font-weight:800}.standalone-account-header h1{margin:0;font-size:clamp(34px,5vw,60px);letter-spacing:-.04em}.standalone-account-header span{display:block;max-width:720px;margin-top:12px;color:#64748b;line-height:1.7}.standalone-account-status,.standalone-account-grid,.standalone-account-footer{max-width:1080px;margin-left:auto;margin-right:auto}.standalone-account-status{margin-bottom:18px;padding:13px 16px;border:1px solid #b8d6ff;border-radius:14px;background:#eef5ff}.standalone-account-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.standalone-account-card{padding:24px;border:1px solid #dbe5e1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(27,53,48,.06)}.standalone-account-card header,.standalone-account-card .identity,.standalone-account-card.boundary{display:flex;align-items:flex-start;gap:14px}.standalone-account-card header h2,.standalone-account-card.boundary h2{margin:0 0 5px;font-size:19px}.standalone-account-card header p,.standalone-account-card.boundary p,.standalone-account-card .identity span{margin:0;color:#718096}.standalone-account-card.profile{grid-row:span 2}.standalone-account-card .identity{align-items:center;margin-bottom:26px}.standalone-account-card .identity strong,.standalone-account-card .identity span{display:block}.standalone-account-card label span{display:block;margin-bottom:8px;font-size:13px;font-weight:750;color:#526273}.standalone-account-card input{width:100%;box-sizing:border-box;border:1px solid #cad8d3;border-radius:13px;padding:12px 14px;background:#fbfdfc}.standalone-account-card form{display:grid;gap:12px}.standalone-account-card button,.standalone-account-footer button{border:0;border-radius:13px;padding:11px 15px;background:#2459ff;color:white;font-weight:750;cursor:pointer}.standalone-account-card button.secondary{background:#eef3f2;color:#29443d}.standalone-account-card .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.standalone-account-card.organization header{align-items:center}.standalone-account-card.organization .credit{margin-left:auto;padding:7px 10px;border-radius:999px;background:#e6fbf5;color:#087a61}.standalone-account-card.organization form{grid-template-columns:1fr auto;margin-top:20px}.standalone-account-footer{display:flex;justify-content:flex-end;margin-top:20px}.standalone-account-footer .danger{background:#fff0ee;color:#bd342c}.standalone-account-state{min-height:100vh;display:grid;place-content:center;gap:16px;text-align:center;background:#f7faf8}.standalone-account-state button{border:0;border-radius:14px;padding:12px 18px;background:#2459ff;color:#fff;font-weight:800}@media(max-width:760px){.standalone-account-page{padding:20px 16px}.standalone-account-grid{grid-template-columns:1fr}.standalone-account-card.profile{grid-row:auto}.standalone-account-card.organization form{grid-template-columns:1fr}.standalone-account-header>div{margin-top:18px}}
`);

write('frontend/src/components/agent/TeachingAssetRegistry.tsx', `import type { AgentTeachingAsset, AgentTeachingInteractionResult } from '../../lib/api-agent';
import { TeachingAssetMicroLesson } from '../../pages/special-practice/adaptive/FunctionShiftMicroLesson';

type TeachingAction = 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed';
export type TeachingAssetRendererProps = {
  asset: AgentTeachingAsset;
  roundId?: number;
  questionId?: number;
  recordInteraction?: (input: { clientRequestId: string; action: TeachingAction; value?: string | number | boolean }) => Promise<AgentTeachingInteractionResult>;
  onCompleted?: () => Promise<void> | void;
};

export const TEACHING_ASSET_REGISTRY = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true }
} as const;

export function teachingAssetRegistryKey(asset: AgentTeachingAsset) {
  return asset.component.key + '@' + asset.component.version;
}

export function TeachingAssetRenderer(props: TeachingAssetRendererProps) {
  const registryKey = teachingAssetRegistryKey(props.asset);
  const capability = TEACHING_ASSET_REGISTRY[registryKey as keyof typeof TEACHING_ASSET_REGISTRY];
  if (!capability) return <section className="agent-teaching-asset-fallback" role="status"><strong>{props.asset.title}</strong><p>{props.asset.summary}</p><small>该教学内容需要更新客户端后才能互动。当前任务不会被关闭。</small></section>;
  return <TeachingAssetMicroLesson {...props} />;
}
`);

write('backend/src/agent/teaching-asset-registry.ts', `export const TEACHING_ASSET_CAPABILITIES = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false }
} as const;

export type TeachingAssetCapabilityKey = keyof typeof TEACHING_ASSET_CAPABILITIES;

export function getTeachingAssetCapability(componentKey: string, componentVersion: string) {
  return TEACHING_ASSET_CAPABILITIES[(componentKey + '@' + componentVersion) as TeachingAssetCapabilityKey] ?? null;
}
`);

write('frontend/authoring.html', `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Moodlelike Authoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main-authoring.tsx"></script>
  </body>
</html>
`);

write('frontend/src/main-authoring.tsx', `import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthoringApp from './AuthoringApp';
import { I18nProvider } from './i18n/I18nProvider';
import './styles.css';
import './styles/authoring-entry.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider><AuthoringApp /></I18nProvider>
  </React.StrictMode>
);
`);

write('frontend/src/AuthoringApp.tsx', `import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { useAuthSession } from './lib/use-auth-session';
import type { User } from './lib/api';

const AdminAIQuestionBankPage = lazy(() => import('./pages/AdminAIQuestionBankPage').then((module) => ({ default: module.AdminAIQuestionBankPage })));
const AdminTeachingAssetsPage = lazy(() => import('./pages/AdminTeachingAssetsPage').then((module) => ({ default: module.AdminTeachingAssetsPage })));
const PublicAuthPage = lazy(() => import('./pages/PublicAuthPage').then((module) => ({ default: module.PublicAuthPage })));

type Workspace = 'questions' | 'teaching-assets';
function readWorkspace(): Workspace {
  return new URLSearchParams(window.location.search).get('workspace') === 'teaching-assets' ? 'teaching-assets' : 'questions';
}

export default function AuthoringApp() {
  const { currentUser, setCurrentUser, isResolvingAuth, setIsResolvingAuth } = useAuthSession(true);
  const [workspace, setWorkspace] = useState<Workspace>(() => readWorkspace());
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const sync = () => setWorkspace(readWorkspace());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function completeAuth(user: User) {
    setCurrentUser(user);
    setIsResolvingAuth(false);
    setShowAuth(false);
  }

  if (isResolvingAuth) return <main className="authoring-access"><span className="authoring-spinner" /><p>正在验证内容生产权限…</p></main>;
  if (showAuth || !currentUser) return <Suspense fallback={<main className="authoring-access">Loading…</main>}><PublicAuthPage initialMode="login" redirectTo="/authoring.html" onBackHome={() => { window.location.href = '/'; }} onGoToMe={completeAuth} /></Suspense>;
  if (currentUser.role !== 'admin') return <main className="authoring-access"><Icon name="lucide:shield-alert" /><h1>当前账号没有内容生产权限</h1><p>{currentUser.email}</p><div><button type="button" onClick={() => setShowAuth(true)}>切换管理员账号</button><a href="/">返回学生 Agent</a></div></main>;

  return <Suspense fallback={<main className="authoring-access">正在加载内容生产工作区…</main>}>
    {workspace === 'teaching-assets'
      ? <AdminTeachingAssetsPage currentUser={currentUser} onGoToAuth={() => setShowAuth(true)} />
      : <AdminAIQuestionBankPage currentUser={currentUser} onGoToAuth={() => setShowAuth(true)} />}
  </Suspense>;
}
`);

write('frontend/src/styles/authoring-entry.css', `.authoring-access{min-height:100vh;display:grid;place-content:center;justify-items:center;gap:14px;padding:28px;background:#f5f8f7;color:#17213a;text-align:center}.authoring-access>svg{width:44px;height:44px;color:#2459ff}.authoring-access h1,.authoring-access p{margin:0}.authoring-access div{display:flex;gap:10px;margin-top:8px}.authoring-access button,.authoring-access a{border:1px solid #cbd9d4;border-radius:12px;padding:10px 14px;background:#fff;color:#23443d;font:inherit;font-weight:750;text-decoration:none;cursor:pointer}.authoring-access button{border-color:#2459ff;background:#2459ff;color:#fff}.authoring-spinner{width:28px;height:28px;border:3px solid #d9e2ff;border-top-color:#2459ff;border-radius:50%;animation:authoring-spin .8s linear infinite}@keyframes authoring-spin{to{transform:rotate(360deg)}}
`);

write('frontend/playwright.golden.config.ts', `import { defineConfig, devices } from '@playwright/test';

const localNoProxy = 'localhost,127.0.0.1,::1';
process.env.NO_PROXY = [process.env.NO_PROXY, localNoProxy].filter(Boolean).join(',');
process.env.no_proxy = [process.env.no_proxy, localNoProxy].filter(Boolean).join(',');
const port = process.env.E2E_PORT || '5198';
const host = process.env.E2E_HOST || '127.0.0.1';
const baseURL = 'http://' + host + ':' + port;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './e2e',
  timeout: 35_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report/golden' }]] : 'line',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: npmCommand + ' run dev:force -- --host ' + host + ' --port ' + port,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 45_000,
    env: { ...process.env, VITE_AGENT_WEB_ENABLED: 'true', VITE_STANDALONE_AGENT: '1' }
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }]
});
`);

write('frontend/e2e/authoring-golden.spec.ts', `import { expect, test, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const payload = {
  schemaVersion: '1', title: '看懂函数图像的水平平移', summary: '拖动 h，观察函数顶点如何移动。',
  instructions: ['先把 h 调到 0。', '再尝试正数和负数。'],
  component: { key: 'math.function-horizontal-shift', version: '1', props: { baseExpression: 'x^2', shiftMin: -4, shiftMax: 4, initialShift: 0 } },
  activePrompt: { id: 'shift-check-v1', prompt: 'h=3 时顶点在哪里？', options: [{ id: 'left', label: '(-3,0)' }, { id: 'right', label: '(3,0)' }], correctAnswer: 'right', correctFeedback: '正确。', incorrectFeedback: '再观察。' },
  verificationPolicy: { required: true, mode: 'next_fresh_question', completionIsMasteryEvidence: false }
};
const topic = { id: 11, code: 'M-FUNCTION-SHIFT', title: '函数平移', subject: 'math', syllabusVersion: '2026', status: 'published' };
function asset(status: 'approved' | 'published') {
  return {
    id: 'asset-1', stableKey: 'math.function-horizontal-shift', type: 'micro_lesson', subjectCode: 'math', status, updatedAt: '2026-09-17T00:00:00.000Z', _count: { exposures: 0 },
    topics: [{ topicId: topic.id, topic }],
    versions: [{ id: 'version-1', version: 1, status, language: 'zh-CN', difficultyBand: 'foundation', estimatedMinutes: 3, renderer: 'interactive_component', componentKey: 'math.function-horizontal-shift', componentVersion: '1', payloadSchemaVersion: 'function-horizontal-shift-v1', payload, fallbackPayload: { title: payload.title, body: payload.summary }, sourceRefs: [{ type: 'syllabus_topic', id: '11', version: '2026' }], reviewState: 'approved', reviewedByUserId: 1, reviewedAt: '2026-09-17T00:00:00.000Z', publishedAt: status === 'published' ? '2026-09-17T00:01:00.000Z' : null, retiredAt: null, updatedAt: '2026-09-17T00:00:00.000Z' }]
  };
}
const emptyMetrics = { exposureContexts: 0, uniqueLearners: 0, completedContexts: 0, skippedContexts: 0, completionRate: null, sources: {}, activePrompt: { attempts: 0, firstAttempts: 0, firstTryCorrectRate: null, passedContexts: 0 }, independentVerification: { total: 0, conclusive: 0, passed: 0, failed: 0, inconclusive: 0, passRate: null, phases: [] }, stability: { stable: 0, notStable: 0, inconclusive: 0, pending: 0 }, operationalSignal: { policyVersion: '1', signal: 'insufficient_data', reasonCodes: [], automaticAction: false } };
const analytics = { schemaVersion: '1', asset: { id: 'asset-1', stableKey: 'math.function-horizontal-shift', subjectCode: 'math' }, window: { days: 30, since: '2026-08-18T00:00:00.000Z', generatedAt: '2026-09-17T00:00:00.000Z' }, aggregate: emptyMetrics, versions: [{ id: 'version-1', version: 1, language: 'zh-CN', status: 'approved', publishedAt: null, metrics: emptyMetrics }] };
const quality = { schemaVersion: '1', policyVersion: '1', windowDays: 30, summary: { total: 0, open: 0, acknowledged: 0, resolved: 0, review: 0, watch: 0, insufficientData: 0 }, items: [] };
const cohort = { deliveries: 0, completedDeliveries: 0, completionRate: null, independentVerifications: 0, conclusiveVerifications: 0, verificationPassRate: null, stabilityAssessments: 0, stableCount: 0, notStableCount: 0, stableRate: null };
const routing = { schemaVersion: '1', policyVersion: '1', currentMode: 'shadow', rollout: { subjects: [], percent: 0 }, window: { days: 30, since: '2026-08-18T00:00:00.000Z', generatedAt: '2026-09-17T00:00:00.000Z' }, gate: { qualified: false, minimumDecisions: 30, reasonCodes: ['insufficient_sample'], automaticActivation: false }, metrics: { decisions: 0, coverageRate: null, fallbackRate: null, divergenceRate: null, explorationRate: null, alternateAfterIneffectiveCount: 0, p95LatencyMs: null, modes: {} }, subjects: [], learningOutcomes: { schemaVersion: '1', observations: 0, policyVersion: '1', evidenceQualified: false, cohorts: { baseline: cohort, active: cohort }, comparison: { verificationPassRateDelta: null, stableRateDelta: null, completionRateDelta: null, consecutiveActiveImmediateFailures: 0 }, circuit: { status: 'monitoring', reasonCodes: [] }, circuitStates: {} }, recent: [] };

test('publishes an approved teaching asset through the isolated authoring entry', async ({ page }) => {
  let published = false;
  await page.addInitScript(() => window.localStorage.setItem('cscalite.accessToken', 'authoring-admin-token'));
  await page.route('**/api/v1/auth/me**', (route) => json(route, { id: '1', email: 'admin@example.com', role: 'admin', displayName: 'Admin', emailVerifiedAt: '2026-09-01T00:00:00.000Z' }));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/quality-alerts', (route) => json(route, quality));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/routing-diagnostics', (route) => json(route, routing));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/asset-1/analytics', (route) => json(route, analytics));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/asset-1', (route) => json(route, { schemaVersion: '1', item: asset(published ? 'published' : 'approved') }));
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets/versions/version-1/publish', (route) => { published = true; return json(route, { schemaVersion: '1', item: asset('published') }); });
  await page.route((url) => url.pathname === '/api/v1/admin/teaching-assets', (route) => json(route, { schemaVersion: '1', items: [asset(published ? 'published' : 'approved')], topics: [topic], componentKeys: ['math.function-horizontal-shift'] }));

  await page.goto('/authoring.html?workspace=teaching-assets');
  await expect(page.getByText('Moodlelike Authoring')).toBeVisible();
  await expect(page.getByRole('button', { name: '发布上线' })).toBeVisible();
  await page.getByRole('button', { name: '发布上线' }).click();
  await expect.poll(() => published).toBe(true);
  await expect(page.getByRole('button', { name: '创建新版本' })).toBeVisible();
});
`);

write('.github/workflows/standalone-ci.yml', `name: standalone-agent-ci

on:
  push:
  pull_request:

jobs:
  contracts-and-golden-paths:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            backend/package-lock.json
            frontend/package-lock.json
      - run: npm ci
      - run: npm ci --prefix backend
      - run: npm ci --prefix frontend
      - run: npm run security:audit-dependencies
      - run: npm exec --prefix frontend -- playwright install --with-deps chromium
      - run: npm run ci:contracts
      - run: npm run ci:golden
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: golden-path-debug
          path: |
            frontend/test-results
            frontend/playwright-report
            artifacts
          if-no-files-found: ignore
`);

write('frontend/scripts/check-standalone-agent-shell.cjs', `const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'StandaloneAgentApp.tsx'), 'utf8');

const checks = [
  [main.includes("import App from './StandaloneAgentApp'"), 'main.tsx must load StandaloneAgentApp'],
  [!main.includes("import App from './App'"), 'main.tsx must not load the legacy site App'],
  [!shell.includes('AppRouteRenderer'), 'standalone shell must not depend on AppRouteRenderer'],
  [shell.includes("import('./pages/AgentPage')"), 'AgentPage must be route-lazy-loaded'],
  [shell.includes("import('./pages/StandaloneAccountPage')"), 'standalone account page must be route-lazy-loaded'],
  [!shell.includes("import('./pages/PublicMePage')"), 'legacy PublicMePage must not be loaded'],
  [shell.includes("type StandaloneRoute = 'agent' | 'auth' | 'onboarding' | 'me'"), 'standalone route allowlist must stay explicit']
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join('\\n'));
  process.exit(1);
}
console.log('Standalone Agent shell contract passed.');
`);

write('frontend/scripts/test-standalone-minimal.cjs', `const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'src/main.tsx',
  'src/StandaloneAgentApp.tsx',
  'src/pages/AgentPage.tsx',
  'src/pages/StandaloneAccountPage.tsx',
  'src/pages/PublicAuthPage.tsx',
  'src/pages/StudentOnboardingPage.tsx',
  'src/components/agent/AgentLearningSettingsView.tsx',
  'src/components/agent/AgentPastPaperWorkspace.tsx'
];
const removedLegacy = [
  'src/App.tsx',
  'src/components/AppRouteRenderer.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/PublicMePage.tsx'
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) throw new Error('Missing standalone runtime file: ' + relativePath);
}
for (const relativePath of removedLegacy) {
  if (fs.existsSync(path.join(root, relativePath))) throw new Error('Legacy site file must stay removed: ' + relativePath);
}

const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/StandaloneAgentApp.tsx'), 'utf8');
if (!main.includes("import App from './StandaloneAgentApp'")) throw new Error('StandaloneAgentApp is not the production entry.');
if (shell.includes('AppRouteRenderer')) throw new Error('Legacy route renderer leaked into standalone shell.');
console.log('Standalone minimal contract passed.');
`);

write('frontend/scripts/audit-standalone-reachability.cjs', `const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(frontendRoot, 'src');
const entry = path.join(srcRoot, 'main.tsx');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
const importPatterns = [
  /(?:import|export)\\s+(?:[^'";]+?\\s+from\\s+)?['"]([^'"]+)['"]/g,
  /import\\(\\s*['"]([^'"]+)['"]\\s*\\)/g,
  /require\\(\\s*['"]([^'"]+)['"]\\s*\\)/g,
  /@import\\s+(?:url\\()?['"]?([^'"\\)\\s;]+)['"]?\\)?/g
];

function normalize(value) {
  return path.resolve(value);
}

function resolveRelative(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...sourceExtensions.map((extension) => base + extension), ...sourceExtensions.map((extension) => path.join(base, 'index' + extension))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function dependencies(file) {
  const text = fs.readFileSync(file, 'utf8');
  const result = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const resolved = resolveRelative(file, match[1]);
      if (resolved && normalize(resolved).startsWith(normalize(srcRoot) + path.sep)) result.add(normalize(resolved));
    }
  }
  return result;
}

const reachable = new Set();
const queue = [normalize(entry)];
while (queue.length) {
  const file = queue.shift();
  if (!file || reachable.has(file)) continue;
  reachable.add(file);
  for (const dependency of dependencies(file)) {
    if (!reachable.has(dependency)) queue.push(dependency);
  }
}

function allSourceFiles(dir) {
  const result = [];
  for (const entryName of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entryName);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) result.push(...allSourceFiles(fullPath));
    else if (sourceExtensions.includes(path.extname(fullPath))) result.push(normalize(fullPath));
  }
  return result;
}

const allFiles = allSourceFiles(srcRoot);
const unreachable = allFiles.filter((file) => !reachable.has(file));
const relative = (file) => path.relative(frontendRoot, file).replaceAll('\\\\', '/');
const report = {
  schemaVersion: '1',
  entry: relative(entry),
  generatedAt: new Date().toISOString(),
  totals: { all: allFiles.length, reachable: reachable.size, unreachable: unreachable.length },
  reachable: [...reachable].map(relative).sort(),
  unreachable: unreachable.map(relative).sort()
};

const reportDir = path.join(frontendRoot, 'artifacts');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'standalone-reachability.json'), JSON.stringify(report, null, 2) + '\\n');
fs.writeFileSync(path.join(reportDir, 'standalone-unreachable.txt'), report.unreachable.join('\\n') + '\\n');
console.log(JSON.stringify(report.totals));
console.log('Wrote frontend/artifacts/standalone-reachability.json');
`);

write('scripts/audit-product-boundaries.cjs', `const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const frontendRoot = path.join(root, 'frontend');
const backendRoot = path.join(root, 'backend');
const backendSrc = path.join(backendRoot, 'src');
const normalize = (value) => path.resolve(value);
const relativeRoot = (value) => path.relative(root, value).replaceAll('\\\\', '/');

function walk(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) output.push(...walk(full, extensions));
    else if (extensions.includes(path.extname(full))) output.push(normalize(full));
  }
  return output;
}

function classifyFrontend(file) {
  if (/^src\\/(AuthoringApp\\.tsx|main-authoring\\.tsx|components\\/(admin|Admin)|pages\\/Admin|styles\\/(admin|authoring-entry)|lib\\/(admin-|api-admin-teaching-assets|ai-questioning-readiness-exports|organization-governance|syllabus-imports))/.test(file)) return 'admin-authoring';
  if (/^src\\/(pages\\/special-practice|styles\\/(visualizers|special-practice-visualizers)|components\\/(NewtonSecondLawCanvas|SolidGeometryCanvas))/.test(file)) return 'teaching-assets';
  return 'obsolete-candidate';
}

const frontendReachabilityPath = path.join(frontendRoot, 'artifacts', 'standalone-reachability.json');
if (!fs.existsSync(frontendReachabilityPath)) throw new Error('Run npm --prefix frontend run audit:standalone-reachability first.');
const frontendReachability = JSON.parse(fs.readFileSync(frontendReachabilityPath, 'utf8'));
const frontendGroups = { 'student-agent': frontendReachability.reachable, 'admin-authoring': [], 'teaching-assets': [], 'obsolete-candidate': [] };
for (const file of frontendReachability.unreachable) frontendGroups[classifyFrontend(file)].push(file);

const backendExtensions = ['.ts', '.tsx', '.js', '.json'];
function resolveBackendImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...backendExtensions.map((ext) => base + ext), ...backendExtensions.map((ext) => path.join(base, 'index' + ext))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

const importPatterns = [
  /(?:import|export)\\s+(?:[^'\";]+?\\s+from\\s+)?['\"]([^'\"]+)['\"]/g,
  /import\\(\\s*['\"]([^'\"]+)['\"]\\s*\\)/g,
  /require\\(\\s*['\"]([^'\"]+)['\"]\\s*\\)/g
];
function backendDependencies(file) {
  const text = fs.readFileSync(file, 'utf8');
  const dependencies = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const resolved = resolveBackendImport(file, match[1]);
      if (resolved && normalize(resolved).startsWith(normalize(backendSrc) + path.sep)) dependencies.add(normalize(resolved));
    }
  }
  return dependencies;
}

const backendEntry = normalize(path.join(backendSrc, 'app.module.ts'));
const backendReachable = new Set();
const queue = [backendEntry];
while (queue.length) {
  const file = queue.shift();
  if (!file || backendReachable.has(file)) continue;
  backendReachable.add(file);
  for (const dependency of backendDependencies(file)) if (!backendReachable.has(dependency)) queue.push(dependency);
}
const allBackend = walk(backendSrc, ['.ts', '.tsx']);
const backendUnreachable = allBackend.filter((file) => !backendReachable.has(file));
function topLevelBackendArea(file) {
  const relative = path.relative(backendSrc, file).replaceAll('\\\\', '/');
  return relative.includes('/') ? relative.split('/')[0] : '(root)';
}
const backendAreas = {};
for (const file of allBackend) {
  const area = topLevelBackendArea(file);
  backendAreas[area] ||= { total: 0, reachable: 0, unreachable: 0 };
  backendAreas[area].total += 1;
  if (backendReachable.has(file)) backendAreas[area].reachable += 1;
  else backendAreas[area].unreachable += 1;
}

const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const models = [...schema.matchAll(/^model\\s+(\\w+)\\s*\\{/gm)].map((match) => match[1]);
const reachableBackendText = [...backendReachable].map((file) => fs.readFileSync(file, 'utf8')).join('\\n');
const prismaModels = models.map((model) => {
  const accessor = model[0].toLowerCase() + model.slice(1);
  const accessorMatches = reachableBackendText.match(new RegExp('\\\\.' + accessor + '\\\\b', 'g')) || [];
  const typeMatches = reachableBackendText.match(new RegExp('\\\\b' + model + '\\\\b', 'g')) || [];
  return { model, accessor, prismaAccessorMentions: accessorMatches.length, typeMentions: typeMatches.length, reviewCandidate: accessorMatches.length === 0 && typeMatches.length === 0 };
});

const report = {
  schemaVersion: '1',
  generatedAt: new Date().toISOString(),
  frontend: {
    totals: Object.fromEntries(Object.entries(frontendGroups).map(([key, files]) => [key, files.length])),
    groups: frontendGroups
  },
  backend: {
    entry: relativeRoot(backendEntry),
    totals: { all: allBackend.length, reachable: backendReachable.size, unreachable: backendUnreachable.length },
    areas: backendAreas,
    reachable: [...backendReachable].map(relativeRoot).sort(),
    unreachable: backendUnreachable.map(relativeRoot).sort()
  },
  prisma: {
    totalModels: prismaModels.length,
    reviewCandidates: prismaModels.filter((item) => item.reviewCandidate).length,
    models: prismaModels
  }
};

const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'product-boundary-audit.json'), JSON.stringify(report, null, 2) + '\\n');
const lines = [
  '# Product boundary audit',
  '',
  'Generated: ' + report.generatedAt,
  '',
  '## Frontend',
  '',
  ...Object.entries(report.frontend.totals).map(([key, count]) => '- ' + key + ': ' + count),
  '',
  '## Backend areas',
  '',
  '| Area | Total | Reachable | Unreachable |',
  '| --- | ---: | ---: | ---: |',
  ...Object.entries(backendAreas).sort(([a], [b]) => a.localeCompare(b)).map(([area, value]) => '| ' + area + ' | ' + value.total + ' | ' + value.reachable + ' | ' + value.unreachable + ' |'),
  '',
  '## Prisma review candidates',
  '',
  'Static absence is not deletion authority; relations, raw SQL and migration compatibility still require review.',
  '',
  ...prismaModels.filter((item) => item.reviewCandidate).map((item) => '- ' + item.model)
];
fs.writeFileSync(path.join(artifactDir, 'product-boundary-audit.md'), lines.join('\\n') + '\\n');
console.log(JSON.stringify({ frontend: report.frontend.totals, backend: report.backend.totals, prisma: { totalModels: report.prisma.totalModels, reviewCandidates: report.prisma.reviewCandidates } }));
console.log('Wrote artifacts/product-boundary-audit.json and .md');
`);

write('scripts/check-teaching-asset-registry.cjs', `const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const backendRegistry = read('backend/src/agent/teaching-asset-registry.ts');
const frontendRegistry = read('frontend/src/components/agent/TeachingAssetRegistry.tsx');
const agentPage = read('frontend/src/pages/AgentPage.tsx');
const teachingService = read('backend/src/agent/agent-teaching-asset.service.ts');
const keys = ['math.function-horizontal-shift@1', 'physics.newton-second-law@1', 'chemistry.acid-base-neutralization@1'];

for (const key of keys) {
  if (!backendRegistry.includes("'" + key + "'")) throw new Error('Backend teaching registry is missing ' + key);
  if (!frontendRegistry.includes("'" + key + "'")) throw new Error('Frontend teaching registry is missing ' + key);
}
if (!backendRegistry.includes('preservesPrimaryTask: true')) throw new Error('Teaching assets must preserve the primary task.');
if (!backendRegistry.includes('completionChangesMastery: false')) throw new Error('Teaching completion must not become mastery evidence.');
if (!agentPage.includes('TeachingAssetRenderer')) throw new Error('AgentPage must render teaching assets through the registry.');
if (agentPage.includes("import { FunctionShiftMicroLesson }")) throw new Error('AgentPage must not import a concrete micro-lesson renderer.');
if (!agentPage.includes('chatTeachingWorkspace = teachingWorkspace && hasPrimaryTaskWorkspace ? teachingWorkspace : null')) throw new Error('Teaching content must stay in chat while a primary task is open.');
if (!teachingService.includes('getTeachingAssetCapability')) throw new Error('Backend presentation must publish registered capabilities.');
console.log('Teaching asset registry contract passed.');
`);

write('scripts/check-authoring-boundary.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const html = read('frontend/authoring.html');
const main = read('frontend/src/main-authoring.tsx');
const app = read('frontend/src/AuthoringApp.tsx');
const studentMain = read('frontend/src/main.tsx');
const vite = read('frontend/vite.config.mjs');
const consoleShell = read('frontend/src/components/admin/AdminConsoleShell.tsx');
const teachingController = read('backend/src/agent/admin-teaching-assets.controller.ts');
const questioningController = read('backend/src/ai-questioning/ai-questioning.controller.ts');

if (!html.includes('/src/main-authoring.tsx')) throw new Error('authoring.html must have its own entry.');
if (!main.includes("import AuthoringApp from './AuthoringApp'")) throw new Error('Authoring entry must load AuthoringApp.');
if (!vite.includes("authoring: resolve(process.cwd(), 'authoring.html')")) throw new Error('Vite must build authoring as a separate HTML entry.');
if (!app.includes("currentUser.role !== 'admin'")) throw new Error('Authoring UI must enforce the admin role boundary.');
if (!app.includes("import('./pages/AdminAIQuestionBankPage')") || !app.includes("import('./pages/AdminTeachingAssetsPage')")) throw new Error('Authoring must lazy-load question and teaching workspaces.');
for (const forbidden of ['AdminUsersPage', 'AdminOrganizationsPage', 'AdminContentPage', 'CartPage', 'HomePage']) if (app.includes(forbidden)) throw new Error('Forbidden workspace leaked into AuthoringApp: ' + forbidden);
if (studentMain.includes('AuthoringApp') || studentMain.includes('main-authoring')) throw new Error('Student Agent entry must not import authoring.');
if (!consoleShell.includes('isStandaloneAuthoring ? authoringGroups')) throw new Error('Authoring navigation must use its reduced workspace list.');
if (!teachingController.includes('@UseGuards(RequiredAdminGuard)')) throw new Error('Teaching asset API must require admin authorization.');
if (!questioningController.includes('@UseGuards(RequiredAdminGuard)')) throw new Error('Question authoring API must require admin authorization.');
console.log('Independent authoring boundary contract passed.');
`);

write('scripts/check-standalone-ci.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/standalone-ci.yml'), 'utf8');
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, 'frontend/package.json'), 'utf8'));
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const marker of ['npm run security:audit-dependencies', 'npm run ci:contracts', 'npm run ci:golden', 'playwright install --with-deps chromium', 'actions/upload-artifact@v4']) {
  if (!workflow.includes(marker)) throw new Error('Standalone CI is missing: ' + marker);
}
for (const script of ['test:e2e:golden:student', 'test:e2e:golden:teaching', 'test:e2e:golden:authoring', 'test:e2e:golden']) {
  if (!frontendPackage.scripts[script]) throw new Error('Frontend golden-path script is missing: ' + script);
}
for (const script of ['ci:contracts', 'ci:golden', 'security:audit-dependencies', 'test:teaching-assets', 'test:authoring-boundary']) {
  if (!rootPackage.scripts[script]) throw new Error('Root CI gate is missing: ' + script);
}
if (/DATABASE_URL:\s*postgres/i.test(workflow) || /OPENAI_API_KEY:\s*\S+/i.test(workflow)) throw new Error('CI workflow must not embed service credentials.');
console.log('Standalone CI contract passed.');
`);

write('scripts/audit-standalone-environment.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const boundary = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/product-boundary-audit.json'), 'utf8'));
const frontendReachability = JSON.parse(fs.readFileSync(path.join(root, 'frontend/artifacts/standalone-reachability.json'), 'utf8'));
const files = [...boundary.backend.reachable.map((item) => path.join(root, item)), ...frontendReachability.reachable.map((item) => path.join(root, 'frontend', item)), path.join(root, 'scripts/start-agent-dev.ps1'), path.join(root, 'scripts/start-backend-dev.cjs')].filter((item) => fs.existsSync(item));
const references = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of [/process\.env\.([A-Z][A-Z0-9_]+)/g, /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g, /import\.meta\.env\.([A-Z][A-Z0-9_]+)/g, /\$env:([A-Z][A-Z0-9_]+)/g]) {
    for (const match of text.matchAll(pattern)) { const key = match[1]; if (!references.has(key)) references.set(key, new Set()); references.get(key).add(path.relative(root, file).replaceAll('\\\\', '/')); }
  }
}
function parseExample(name) { const result = new Map(); for (const line of fs.readFileSync(path.join(root, name), 'utf8').split(/\\r?\\n/)) { const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (match) result.set(match[1], match[2].replace(/^"|"$/g, '')); } return result; }
const development = parseExample('.env.example');
const production = parseExample('.env.production.example');
const requiredProduction = ['DATABASE_URL', 'AUTH_SECRET', 'CORS_ORIGINS', 'PUBLIC_APP_ORIGIN', 'PUBLIC_API_ORIGIN'];
const secretPattern = /(SECRET|PASSWORD|TOKEN|API_KEY|API_KEYS|PRIVATE_KEY)$/;
const safePlaceholder = (value) => value === '' || /replace|example|change|placeholder/i.test(value);
const unsafeExampleValues = [];
for (const [key, value] of [...development, ...production]) if (secretPattern.test(key) && !safePlaceholder(value)) unsafeExampleValues.push(key);
const all = [...references].map(([key, sources]) => ({ key, category: secretPattern.test(key) ? 'secret' : key.startsWith('VITE_') ? 'frontend-public' : 'runtime-config', documentedDevelopment: development.has(key), documentedProduction: production.has(key), sources: [...sources].sort() })).sort((a, b) => a.key.localeCompare(b.key));
const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), reachableFilesScanned: files.length, runtimeVariableCount: all.length, requiredProduction, missingRequiredDevelopment: requiredProduction.filter((key) => !development.has(key)), missingRequiredProduction: requiredProduction.filter((key) => !production.has(key)), undocumentedRuntimeVariables: all.filter((item) => !item.documentedDevelopment && !item.documentedProduction).map((item) => item.key), unsafeExampleValues: [...new Set(unsafeExampleValues)].sort(), variables: all };
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/environment-contract.json'), JSON.stringify(report, null, 2) + '\\n');
const rows = all.map((item) => '| ' + item.key + ' | ' + item.category + ' | ' + (item.documentedDevelopment ? 'yes' : 'no') + ' | ' + (item.documentedProduction ? 'yes' : 'no') + ' |');
fs.writeFileSync(path.join(root, 'artifacts/environment-contract.md'), ['# Environment variable inventory', '', 'Generated from the reachable Agent runtime. Values are never included.', '', '| Variable | Category | Dev example | Production example |', '| --- | --- | --- | --- |', ...rows, '', 'Undocumented variables use code defaults and remain compatibility debt; they are not automatically required.', ''].join('\\n'));
if (report.missingRequiredDevelopment.length || report.missingRequiredProduction.length || report.unsafeExampleValues.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(JSON.stringify({ runtimeVariables: report.runtimeVariableCount, undocumented: report.undocumentedRuntimeVariables.length, unsafeExampleValues: 0 }));
`);

write('scripts/check-release-baseline.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const expected = ['LICENSE', 'SECURITY.md', 'RELEASE_BASELINE.md', 'ENVIRONMENT_CONTRACT.md', 'SOURCE_PROVENANCE.md', 'VERSION', '.gitattributes', '.gitignore', '.env.example', '.env.production.example', 'artifacts/environment-contract.json'];
for (const item of expected) if (!fs.existsSync(path.join(root, item))) throw new Error('Release baseline file missing: ' + item);
const packages = [['package.json', 'moodlelike-agent'], ['backend/package.json', '@moodlelike/backend'], ['frontend/package.json', '@moodlelike/frontend'], ['question-engine/package.json', '@moodlelike/question-engine']];
for (const [file, name] of packages) { const value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); if (value.name !== name || value.version !== '0.1.0-alpha.3' || value.private !== true) throw new Error('Package identity mismatch: ' + file); if (value.engines?.node !== '>=22 <23') throw new Error('Node engine missing: ' + file); }
const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const marker of ['node_modules/', '.env', '.local/', 'dist/', '*.log']) if (!ignore.includes(marker)) throw new Error('.gitignore missing: ' + marker);
const prohibited = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (['.git', '.local', 'node_modules', 'dist', 'test-results', 'playwright-report'].includes(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else { const rel = path.relative(root, full).replaceAll('\\\\', '/'); if ((entry.name.startsWith('.env') && !['.env.example', '.env.production.example'].includes(entry.name)) || /\.(dump|pem|p12|pfx)$/i.test(entry.name)) prohibited.push(rel); } } }
walk(root);
if (prohibited.length) throw new Error('Prohibited release files: ' + prohibited.join(', '));
const provenance = fs.readFileSync(path.join(root, 'SOURCE_PROVENANCE.md'), 'utf8');
if (/[A-Z]:\\\\/i.test(provenance)) throw new Error('Source provenance must not expose a local absolute path.');
const envReport = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/environment-contract.json'), 'utf8'));
if (envReport.missingRequiredDevelopment.length || envReport.missingRequiredProduction.length || envReport.unsafeExampleValues.length) throw new Error('Environment contract has release blockers.');
console.log(JSON.stringify({ version: '0.1.0-alpha.3', packages: packages.length, environmentVariables: envReport.runtimeVariableCount, prohibitedFiles: 0 }));
`);

write('scripts/lib/standalone-data-migration-policy.cjs', `const path = require('node:path');

function parsePostgresUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(label + ' must be a valid PostgreSQL URL.'); }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error(label + ' must use postgres:// or postgresql://.');
  const database = decodeURIComponent(parsed.pathname.replace(/^\\//, '').split('?')[0] || '');
  if (!parsed.hostname || !database) throw new Error(label + ' must include host and database name.');
  return { protocol: parsed.protocol, host: parsed.hostname.toLowerCase(), port: parsed.port || '5432', database, username: decodeURIComponent(parsed.username || ''), url: value };
}

function identity(database) { return database.host + ':' + database.port + '/' + database.database.toLowerCase(); }
function publicIdentity(database) { return database.host + ':' + database.port + '/' + database.database; }
function sanitizeUrl(value) {
  const parsed = new URL(value);
  if (parsed.username) parsed.username = 'user';
  if (parsed.password) parsed.password = '***';
  return parsed.toString();
}
function isLocalHost(host) { return host === 'localhost' || host === '127.0.0.1' || host === '::1'; }

function validateMigrationInputs({ sourceUrl, targetUrl, confirmTarget, allowRemoteTarget = false }) {
  const source = parsePostgresUrl(sourceUrl, 'CSCALITE_SOURCE_DATABASE_URL');
  const target = parsePostgresUrl(targetUrl, 'MOODLELIKE_TARGET_DATABASE_URL');
  if (identity(source) === identity(target)) throw new Error('Source and target databases must be different.');
  if (confirmTarget !== target.database) throw new Error('CONFIRM_MOODLELIKE_TARGET_DATABASE must exactly match the target database name.');
  if (!allowRemoteTarget && !isLocalHost(target.host)) throw new Error('Remote targets require ALLOW_REMOTE_MOODLELIKE_TARGET=1.');
  return { source, target };
}

function validateRollbackTarget({ targetUrl, confirmTarget, expectedIdentity, expectedDatabase, allowRemoteTarget = false }) {
  const target = parsePostgresUrl(targetUrl, 'MOODLELIKE_TARGET_DATABASE_URL');
  if (confirmTarget !== target.database) throw new Error('CONFIRM_MOODLELIKE_TARGET_DATABASE must exactly match the target database name.');
  if (expectedIdentity !== publicIdentity(target) || expectedDatabase !== target.database) throw new Error('Rollback target does not exactly match the migration manifest.');
  if (!allowRemoteTarget && !isLocalHost(target.host)) throw new Error('Remote targets require ALLOW_REMOTE_MOODLELIKE_TARGET=1.');
  return target;
}

function safeRunDirectory(root, runId) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('Migration run id contains unsupported characters.');
  const base = path.resolve(root, '.local', 'data-migrations');
  const runDir = path.resolve(base, runId);
  if (!runDir.startsWith(base + path.sep)) throw new Error('Migration run directory escaped the local migration root.');
  return runDir;
}

function postgresToolUrl(databaseUrl) { const parsed = new URL(databaseUrl); parsed.searchParams.delete('schema'); return parsed.toString(); }
function dumpArgs(databaseUrl, outputFile) { return ['--format=custom', '--no-owner', '--no-privileges', '--file', outputFile, '--dbname', postgresToolUrl(databaseUrl)]; }
function restoreArgs(databaseUrl, dumpFile) { return ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', postgresToolUrl(databaseUrl), dumpFile]; }
function resetPublicSchemaArgs(databaseUrl) { return ['--dbname', postgresToolUrl(databaseUrl), '--set', 'ON_ERROR_STOP=1', '--command', 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;']; }

module.exports = { parsePostgresUrl, identity, publicIdentity, sanitizeUrl, validateMigrationInputs, validateRollbackTarget, safeRunDirectory, postgresToolUrl, dumpArgs, restoreArgs, resetPublicSchemaArgs };
`);

write('scripts/standalone-data-migration.cjs', `const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateMigrationInputs, publicIdentity, sanitizeUrl, safeRunDirectory, dumpArgs, restoreArgs, resetPublicSchemaArgs } = require('./lib/standalone-data-migration-policy.cjs');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const sourceUrl = process.env.CSCALITE_SOURCE_DATABASE_URL || '';
const targetUrl = process.env.MOODLELIKE_TARGET_DATABASE_URL || '';
const confirmTarget = process.env.CONFIRM_MOODLELIKE_TARGET_DATABASE || '';
const allowRemoteTarget = process.env.ALLOW_REMOTE_MOODLELIKE_TARGET === '1';
if (!sourceUrl || !targetUrl) {
  console.error('Set CSCALITE_SOURCE_DATABASE_URL and MOODLELIKE_TARGET_DATABASE_URL. Default mode is plan-only.');
  process.exit(1);
}
let validated;
try { validated = validateMigrationInputs({ sourceUrl, targetUrl, confirmTarget, allowRemoteTarget }); }
catch (error) { console.error(error.message); process.exit(1); }

const runId = process.env.MOODLELIKE_MIGRATION_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const runDir = safeRunDirectory(root, runId);
const targetBackup = path.join(runDir, 'target-before.dump');
const sourceDump = path.join(runDir, 'source-cscalite.dump');
const manifestPath = path.join(runDir, 'manifest.json');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', source: sanitizeUrl(sourceUrl), target: sanitizeUrl(targetUrl), runDir, steps: ['backup-target', 'dump-source', 'reset-target-public-schema', 'restore-source-to-target', 'write-manifest'] }, null, 2));
if (!apply) { console.log('Plan only; no database command executed.'); process.exit(0); }

fs.mkdirSync(runDir, { recursive: true });
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
const toolMount = process.env.MOODLELIKE_PG_TOOL_CONTAINER_MOUNT || '/migration';
function containerArgs(args) {
  return args.map((arg) => {
    if (typeof arg !== 'string') return arg;
    if (arg.startsWith(path.resolve(root, '.local', 'data-migrations'))) return toolMount + arg.slice(path.resolve(root, '.local', 'data-migrations').length).replaceAll('\\\\', '/');
    if (arg.startsWith('postgres://') || arg.startsWith('postgresql://')) { const url = new URL(arg); url.hostname = 'localhost'; url.port = '5432'; return url.toString(); }
    return arg;
  });
}
function run(command, args, step) {
  const executable = toolContainer ? 'docker' : command;
  const commandArgs = toolContainer ? ['exec', toolContainer, command, ...containerArgs(args)] : args;
  const result = spawnSync(executable, commandArgs, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error(step + ' failed: ' + (result.error?.message || 'exit ' + result.status));
}
const manifest = { schemaVersion: '1', runId, status: 'started', startedAt: new Date().toISOString(), source: publicIdentity(validated.source), target: publicIdentity(validated.target), targetDatabase: validated.target.database, targetBackup, sourceDump };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\\n');
try {
  run('pg_dump', dumpArgs(targetUrl, targetBackup), 'Target pre-migration backup');
  run('pg_dump', dumpArgs(sourceUrl, sourceDump), 'Source export');
  run('psql', resetPublicSchemaArgs(targetUrl), 'Target public schema reset');
  run('pg_restore', restoreArgs(targetUrl, sourceDump), 'Source restore into target');
  Object.assign(manifest, { status: 'completed', completedAt: new Date().toISOString() });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\\n');
  console.log('Migration completed. Rollback manifest: ' + manifestPath);
} catch (error) {
  Object.assign(manifest, { status: 'failed', failedAt: new Date().toISOString(), error: error.message });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\\n');
  console.error(error.message); process.exit(1);
}
`);

write('scripts/standalone-data-rollback.cjs', `const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateRollbackTarget, restoreArgs, resetPublicSchemaArgs } = require('./lib/standalone-data-migration-policy.cjs');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='));
const targetUrl = process.env.MOODLELIKE_TARGET_DATABASE_URL || '';
const confirmTarget = process.env.CONFIRM_MOODLELIKE_TARGET_DATABASE || '';
const allowRemoteTarget = process.env.ALLOW_REMOTE_MOODLELIKE_TARGET === '1';
if (!manifestArg || !targetUrl) { console.error('Usage: set MOODLELIKE_TARGET_DATABASE_URL and pass --manifest=<path>.'); process.exit(1); }
const manifestPath = path.resolve(root, manifestArg.slice('--manifest='.length));
const allowedRoot = path.resolve(root, '.local', 'data-migrations');
if (!manifestPath.startsWith(allowedRoot + path.sep) || !fs.existsSync(manifestPath)) { console.error('Rollback manifest must exist under .local/data-migrations.'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let target;
try { target = validateRollbackTarget({ targetUrl, confirmTarget, expectedIdentity: manifest.target, expectedDatabase: manifest.targetDatabase, allowRemoteTarget }); }
catch (error) { console.error(error.message); process.exit(1); }
const manifestDir = path.dirname(manifestPath);
const expectedBackup = path.join(manifestDir, 'target-before.dump');
if (path.resolve(manifest.targetBackup || '') !== expectedBackup) { console.error('Rollback backup path does not match the selected migration run.'); process.exit(1); }
if (!fs.existsSync(manifest.targetBackup)) { console.error('Target pre-migration backup is missing.'); process.exit(1); }
console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', target: manifest.target, backup: manifest.targetBackup, migrationRun: manifest.runId }, null, 2));
if (!apply) { console.log('Plan only; target database was not modified.'); process.exit(0); }
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
const toolMount = process.env.MOODLELIKE_PG_TOOL_CONTAINER_MOUNT || '/migration';
function containerArgs(args) { return args.map((arg) => { if (arg.startsWith(allowedRoot)) return toolMount + arg.slice(allowedRoot.length).replaceAll('\\\\', '/'); if (arg.startsWith('postgres://') || arg.startsWith('postgresql://')) { const url = new URL(arg); url.hostname = 'localhost'; url.port = '5432'; return url.toString(); } return arg; }); }
function run(command, args, step) { const executable = toolContainer ? 'docker' : command; const commandArgs = toolContainer ? ['exec', toolContainer, command, ...containerArgs(args)] : args; const result = spawnSync(executable, commandArgs, { cwd: root, stdio: 'inherit', shell: false }); if (result.error || result.status !== 0) throw new Error(step + ' failed: ' + (result.error?.message || 'exit ' + result.status)); }
try { run('psql', resetPublicSchemaArgs(targetUrl), 'Rollback target public schema reset'); run('pg_restore', restoreArgs(targetUrl, manifest.targetBackup), 'Rollback restore'); }
catch (error) { console.error(error.message); process.exit(1); }
manifest.rollback = { status: 'completed', completedAt: new Date().toISOString() };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\\n');
console.log('Rollback completed.');
`);

write('scripts/standalone-data-migration-policy-test.cjs', `const assert = require('node:assert/strict');
const path = require('node:path');
const policy = require('./lib/standalone-data-migration-policy.cjs');
const source = 'postgresql://source:secret@localhost:55432/cscalite';
const target = 'postgresql://target:secret@localhost:56432/moodlelike';
const validated = policy.validateMigrationInputs({ sourceUrl: source, targetUrl: target, confirmTarget: 'moodlelike' });
assert.equal(policy.publicIdentity(validated.source), 'localhost:55432/cscalite');
assert.equal(policy.publicIdentity(validated.target), 'localhost:56432/moodlelike');
assert(!policy.sanitizeUrl(source).includes('secret'));
assert.throws(() => policy.validateMigrationInputs({ sourceUrl: source, targetUrl: source, confirmTarget: 'cscalite' }), /different/);
assert.throws(() => policy.validateMigrationInputs({ sourceUrl: source, targetUrl: target, confirmTarget: 'wrong' }), /exactly match/);
assert.throws(() => policy.validateMigrationInputs({ sourceUrl: source, targetUrl: 'postgresql://x:y@db.example.com/moodlelike', confirmTarget: 'moodlelike' }), /Remote targets/);
assert.throws(() => policy.validateRollbackTarget({ targetUrl: 'postgresql://x:y@db.example.com/moodlelike', confirmTarget: 'moodlelike', expectedIdentity: 'db.example.com:5432/moodlelike', expectedDatabase: 'moodlelike' }), /Remote targets/);
assert.throws(() => policy.validateRollbackTarget({ targetUrl: target, confirmTarget: 'moodlelike', expectedIdentity: 'localhost:56432/other', expectedDatabase: 'other' }), /does not exactly match/);
assert.throws(() => policy.safeRunDirectory('C:/work', '../escape'), /unsupported|escaped/);
assert.deepEqual(policy.restoreArgs(target, 'backup.dump').slice(0, 4), ['--clean', '--if-exists', '--no-owner', '--no-privileges']);
assert.match(policy.resetPublicSchemaArgs(target).at(-1), /DROP SCHEMA IF EXISTS public CASCADE/);
assert(!policy.postgresToolUrl(target + '?schema=public').includes('schema='));
console.log('Standalone data migration policy tests passed.');
`);

write('scripts/lib/standalone-data-preflight-policy.cjs', `const criticalTables = ['_prisma_migrations', 'users', 'student_profiles', 'agent_conversations', 'agent_messages', 'agent_artifacts', 'learning_evidence_events', 'csca_questions', 'csca_adaptive_rounds', 'teaching_assets', 'past_papers'];
const acceptedLegacyUnvalidatedConstraints = new Set(['forecast_calibration_snapshots_qualified_source_check', 'ck_forecast_verified_manifest_required']);

function assessDataPreflight(snapshot) {
  const blockers = [];
  const warnings = [];
  if (Number(snapshot.serverVersionNum || 0) < 160000) blockers.push({ code: 'postgres-version', message: 'PostgreSQL 16 or newer is required for the rehearsed baseline.' });
  if (Number(snapshot.publicTableCount || 0) === 0) blockers.push({ code: 'empty-schema', message: 'No public tables were found.' });
  for (const table of snapshot.criticalTablesMissing || []) blockers.push({ code: 'missing-critical-table', table, message: 'Required Agent table is missing.' });
  if (Number(snapshot.failedMigrationCount || 0) > 0) blockers.push({ code: 'failed-migrations', count: Number(snapshot.failedMigrationCount), message: 'Unfinished Prisma migrations exist.' });
  const unvalidated = snapshot.unvalidatedConstraints || [];
  const unexpectedUnvalidated = unvalidated.filter((item) => !acceptedLegacyUnvalidatedConstraints.has(item.constraint));
  if (unexpectedUnvalidated.length) blockers.push({ code: 'unvalidated-constraints', constraints: unexpectedUnvalidated, message: 'Unexpected unvalidated constraints can hide orphaned or invalid rows.' });
  const acceptedUnvalidated = unvalidated.filter((item) => acceptedLegacyUnvalidatedConstraints.has(item.constraint));
  if (acceptedUnvalidated.length) warnings.push({ code: 'accepted-legacy-unvalidated-constraints', constraints: acceptedUnvalidated, message: 'Known legacy forecast checks remain NOT VALID by design and still constrain new writes.' });
  for (const item of snapshot.sequenceLag || []) blockers.push({ code: 'sequence-behind-data', ...item, message: 'Sequence value is behind the current column maximum.' });
  const approximateRows = snapshot.approximateRows || {};
  for (const table of ['users', 'csca_questions', 'agent_conversations']) if (Number(approximateRows[table] || 0) === 0) warnings.push({ code: 'empty-core-table', table, message: 'Core table is empty; acceptable for a new system but requires confirmation for a real migration.' });
  return { status: blockers.length ? 'blocked' : 'passed', blockers, warnings };
}

module.exports = { criticalTables, acceptedLegacyUnvalidatedConstraints, assessDataPreflight };
`);

write('scripts/standalone-data-preflight-policy-test.cjs', `const assert = require('node:assert/strict');
const { criticalTables, assessDataPreflight } = require('./lib/standalone-data-preflight-policy.cjs');
const clean = assessDataPreflight({ serverVersionNum: 160000, publicTableCount: 149, criticalTablesMissing: [], failedMigrationCount: 0, unvalidatedConstraints: [{ constraint: 'ck_forecast_verified_manifest_required' }], sequenceLag: [], approximateRows: { users: 1, csca_questions: 1, agent_conversations: 1 } });
assert.equal(clean.status, 'passed');
assert.equal(clean.warnings[0].code, 'accepted-legacy-unvalidated-constraints');
const blocked = assessDataPreflight({ serverVersionNum: 150000, publicTableCount: 10, criticalTablesMissing: [criticalTables[0]], failedMigrationCount: 1, unvalidatedConstraints: [{ constraint: 'unexpected_probe' }], sequenceLag: [{ table: 'users', column: 'id' }], approximateRows: {} });
assert.equal(blocked.status, 'blocked');
assert.deepEqual(new Set(blocked.blockers.map((item) => item.code)), new Set(['postgres-version', 'missing-critical-table', 'failed-migrations', 'unvalidated-constraints', 'sequence-behind-data']));
assert(blocked.warnings.length >= 3);
console.log('Standalone data preflight policy tests passed.');
`);

write('scripts/standalone-data-preflight.cjs', `const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parsePostgresUrl, sanitizeUrl, postgresToolUrl } = require('./lib/standalone-data-migration-policy.cjs');
const { criticalTables, assessDataPreflight } = require('./lib/standalone-data-preflight-policy.cjs');

const root = path.resolve(__dirname, '..');
const databaseUrl = process.env.DATABASE_URL || '';
const label = (process.env.DATA_PREFLIGHT_LABEL || 'source').replace(/[^a-zA-Z0-9._-]/g, '-');
const toolContainer = process.env.MOODLELIKE_PG_TOOL_CONTAINER || '';
if (!databaseUrl) { console.error('Set DATABASE_URL. This command performs read-only metadata and aggregate checks.'); process.exit(1); }
let parsed;
try { parsed = parsePostgresUrl(databaseUrl, 'DATABASE_URL'); } catch (error) { console.error(error.message); process.exit(1); }
function toolUrl() { const url = new URL(postgresToolUrl(databaseUrl)); if (toolContainer) { url.hostname = 'localhost'; url.port = '5432'; } return url.toString(); }
function sql(query) {
  const args = ['--dbname', toolUrl(), '--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--command', 'BEGIN READ ONLY; ' + query + ' COMMIT;'];
  const executable = toolContainer ? 'docker' : 'psql';
  const commandArgs = toolContainer ? ['exec', toolContainer, 'psql', ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd: root, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'psql exited with ' + result.status);
  return String(result.stdout || '').split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean).find((line) => line !== 'BEGIN' && line !== 'COMMIT') || '';
}
function quoteIdentifier(value) { return '"' + String(value).replaceAll('"', '""') + '"'; }
try {
  const critical = criticalTables.map((name) => "('" + name.replaceAll("'", "''") + "')").join(',');
  const base = JSON.parse(sql("WITH critical(name) AS (VALUES " + critical + ") SELECT json_build_object('serverVersionNum', current_setting('server_version_num')::int, 'database', current_database(), 'databaseBytes', pg_database_size(current_database()), 'publicTableCount', (SELECT count(*) FROM pg_tables WHERE schemaname='public'), 'unvalidatedConstraints', COALESCE((SELECT json_agg(json_build_object('constraint', conname, 'table', conrelid::regclass::text) ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated), '[]'::json), 'criticalTablesMissing', COALESCE((SELECT json_agg(name ORDER BY name) FROM critical WHERE to_regclass('public.' || quote_ident(name)) IS NULL), '[]'::json), 'approximateRows', COALESCE((SELECT json_object_agg(relname, n_live_tup) FROM pg_stat_user_tables WHERE schemaname='public'), '{}'::json))::text;"));
  const hasMigrationTable = !(base.criticalTablesMissing || []).includes('_prisma_migrations');
  base.failedMigrationCount = hasMigrationTable ? Number(sql('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')) : -1;
  const sequenceRows = sql("SELECT COALESCE(json_agg(json_build_object('schema', ns.nspname, 'sequence', seq.relname, 'tableSchema', tn.nspname, 'table', tab.relname, 'column', att.attname)), '[]'::json)::text FROM pg_class seq JOIN pg_namespace ns ON ns.oid=seq.relnamespace JOIN pg_depend dep ON dep.objid=seq.oid AND dep.deptype IN ('a','i') JOIN pg_class tab ON tab.oid=dep.refobjid JOIN pg_namespace tn ON tn.oid=tab.relnamespace JOIN pg_attribute att ON att.attrelid=tab.oid AND att.attnum=dep.refobjsubid WHERE seq.relkind='S' AND tn.nspname='public';");
  const sequences = JSON.parse(sequenceRows || '[]');
  base.sequenceLag = [];
  for (const item of sequences) {
    const statement = 'SELECT CASE WHEN last_value < COALESCE((SELECT max(' + quoteIdentifier(item.column) + ') FROM ' + quoteIdentifier(item.tableSchema) + '.' + quoteIdentifier(item.table) + '), 0) THEN 1 ELSE 0 END FROM ' + quoteIdentifier(item.schema) + '.' + quoteIdentifier(item.sequence) + ';';
    if (Number(sql(statement)) === 1) base.sequenceLag.push({ table: item.table, column: item.column, sequence: item.sequence });
  }
  const assessment = assessDataPreflight(base);
  const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), label, database: parsed.host + ':' + parsed.port + '/' + parsed.database, connection: sanitizeUrl(databaseUrl), readOnly: true, ...base, ...assessment };
  const out = path.join(root, 'artifacts', 'data-preflight-' + label + '.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\\n');
  console.log(JSON.stringify({ status: report.status, database: report.database, publicTableCount: report.publicTableCount, blockers: report.blockers.length, warnings: report.warnings.length, artifact: out }));
  process.exit(report.status === 'passed' ? 0 : 2);
} catch (error) { console.error('Data preflight failed: ' + error.message); process.exit(1); }
`);

write('scripts/phase3b-data-rehearsal.cjs', `const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');
const hostPort = process.env.PHASE3B_HOST_PORT || '57432';
const sourceDatabase = 'source_phase3b';
const targetDatabase = 'target_phase3b';
const password = 'phase3b-local-only';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const container = 'moodlelike-phase3b-' + process.pid + '-' + Date.now();
const runId = 'phase3b-' + stamp;
const migrationRoot = path.join(root, '.local', 'data-migrations');
const evidenceRoot = path.join(root, 'artifacts');
const sourceUrl = 'postgresql://postgres:' + password + '@localhost:' + hostPort + '/' + sourceDatabase + '?schema=public';
const targetUrl = 'postgresql://postgres:' + password + '@localhost:' + hostPort + '/' + targetDatabase + '?schema=public';
const manifestRelative = path.join('.local', 'data-migrations', runId, 'manifest.json');
const plan = { mode: apply ? 'apply' : 'plan', isolation: 'disposable-docker-container', image: 'postgres:16-alpine', hostPort, sourceDatabase, targetDatabase, steps: ['start-disposable-postgres', 'deploy-97-prisma-migrations-to-source', 'run-clean-and-blocked-preflight-probes', 'seed-source-and-target-probes', 'run-migration-apply', 'verify-schema-and-probes', 'run-rollback-apply', 'verify-exact-rollback', 'remove-disposable-container'] };
console.log(JSON.stringify(plan, null, 2));
if (!apply) { console.log('Plan only; Docker and databases were not touched.'); process.exit(0); }

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || root, env: options.env || process.env, encoding: options.capture ? 'utf8' : undefined, stdio: options.capture ? 'pipe' : 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error((options.label || command) + ' failed: ' + (result.error?.message || result.stderr || 'exit ' + result.status));
  return options.capture ? String(result.stdout || '').trim() : '';
}
function docker(args, options = {}) { return run('docker', args, options); }
function query(database, sql) { return docker(['exec', container, 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { capture: true, label: 'PostgreSQL verification' }); }
function runNode(script, args, extraEnv) { return run(process.execPath, [path.join(root, 'scripts', script), ...args], { env: { ...process.env, ...extraEnv }, label: script }); }

let created = false;
const evidence = { schemaVersion: '1', runId, startedAt: new Date().toISOString(), containerImage: 'postgres:16-alpine', sourceDatabase, targetDatabase, checks: {} };
try {
  fs.mkdirSync(migrationRoot, { recursive: true });
  fs.mkdirSync(evidenceRoot, { recursive: true });
  docker(['run', '-d', '--name', container, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=' + sourceDatabase, '-p', '127.0.0.1:' + hostPort + ':5432', '--mount', 'type=bind,source=' + migrationRoot + ',target=/migration', 'postgres:16-alpine'], { capture: true, label: 'Start disposable PostgreSQL' });
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const check = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', sourceDatabase], { stdio: 'ignore', shell: false });
    if (check.status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready.');
  docker(['exec', container, 'createdb', '-U', 'postgres', targetDatabase], { label: 'Create target database' });
  const prismaCli = path.join(root, 'backend', 'node_modules', 'prisma', 'build', 'index.js');
  run(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', path.join(root, 'backend', 'prisma', 'schema.prisma')], { cwd: path.join(root, 'backend'), env: { ...process.env, DATABASE_URL: sourceUrl }, label: 'Deploy Prisma migrations' });
  const preflightEnv = { DATABASE_URL: sourceUrl, MOODLELIKE_PG_TOOL_CONTAINER: container };
  runNode('standalone-data-preflight.cjs', [], { ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-clean-baseline' });
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE TABLE phase3c_invalid_probe(id integer); ALTER TABLE phase3c_invalid_probe ADD CONSTRAINT phase3c_probe_not_valid CHECK (id > 0) NOT VALID;'], { label: 'Create blocked preflight probe' });
  const blockedProbe = spawnSync(process.execPath, [path.join(root, 'scripts', 'standalone-data-preflight.cjs')], { cwd: root, env: { ...process.env, ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-blocked-probe' }, stdio: 'inherit', shell: false });
  if (blockedProbe.status !== 2) throw new Error('Data preflight did not block an unvalidated constraint.');
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP TABLE phase3c_invalid_probe;'], { label: 'Remove blocked preflight probe' });
  runNode('standalone-data-preflight.cjs', [], { ...preflightEnv, DATA_PREFLIGHT_LABEL: 'phase3c-source' });
  evidence.checks.preflightCleanStatus = 'passed';
  evidence.checks.preflightBlockedProbeStatus = 'blocked';
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', sourceDatabase, '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE phase3b_source_probe(id integer PRIMARY KEY, label text NOT NULL); INSERT INTO phase3b_source_probe VALUES (1, 'alpha'), (2, 'beta');"], { label: 'Seed source probe' });
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE phase3b_target_sentinel(id integer PRIMARY KEY, label text NOT NULL); INSERT INTO phase3b_target_sentinel VALUES (1, 'before');"], { label: 'Seed rollback sentinel' });
  const toolEnv = { CSCALITE_SOURCE_DATABASE_URL: sourceUrl, MOODLELIKE_TARGET_DATABASE_URL: targetUrl, CONFIRM_MOODLELIKE_TARGET_DATABASE: targetDatabase, MOODLELIKE_MIGRATION_RUN_ID: runId, MOODLELIKE_PG_TOOL_CONTAINER: container, MOODLELIKE_PG_TOOL_CONTAINER_MOUNT: '/migration' };
  runNode('standalone-data-migration.cjs', ['--apply'], toolEnv);
  evidence.checks.sourceTableCount = Number(query(sourceDatabase, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
  evidence.checks.migratedTableCount = Number(query(targetDatabase, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"));
  evidence.checks.migratedProbeRows = Number(query(targetDatabase, 'SELECT count(*) FROM phase3b_source_probe;'));
  evidence.checks.targetSentinelAfterMigration = query(targetDatabase, "SELECT COALESCE(to_regclass('public.phase3b_target_sentinel')::text, 'missing');");
  evidence.checks.prismaMigrationRows = Number(query(targetDatabase, 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;'));
  if (evidence.checks.migratedProbeRows !== 2 || evidence.checks.targetSentinelAfterMigration !== 'missing' || evidence.checks.sourceTableCount !== evidence.checks.migratedTableCount) throw new Error('Migration verification did not produce an exact source copy.');
  runNode('standalone-data-rollback.cjs', ['--apply', '--manifest=' + manifestRelative], { MOODLELIKE_TARGET_DATABASE_URL: targetUrl, CONFIRM_MOODLELIKE_TARGET_DATABASE: targetDatabase, MOODLELIKE_PG_TOOL_CONTAINER: container, MOODLELIKE_PG_TOOL_CONTAINER_MOUNT: '/migration' });
  evidence.checks.rollbackSentinelRows = Number(query(targetDatabase, 'SELECT count(*) FROM phase3b_target_sentinel;'));
  evidence.checks.sourceProbeAfterRollback = query(targetDatabase, "SELECT COALESCE(to_regclass('public.phase3b_source_probe')::text, 'missing');");
  if (evidence.checks.rollbackSentinelRows !== 1 || evidence.checks.sourceProbeAfterRollback !== 'missing') throw new Error('Rollback verification failed.');
  Object.assign(evidence, { status: 'passed', completedAt: new Date().toISOString(), manifest: manifestRelative });
  fs.writeFileSync(path.join(evidenceRoot, 'phase3b-data-rehearsal.json'), JSON.stringify(evidence, null, 2) + '\\n');
  console.log('Phase 3B data rehearsal passed.');
} catch (error) {
  Object.assign(evidence, { status: 'failed', failedAt: new Date().toISOString(), error: error.message });
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, 'phase3b-data-rehearsal.json'), JSON.stringify(evidence, null, 2) + '\\n');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) { const removed = spawnSync('docker', ['rm', '-f', container], { stdio: 'inherit', shell: false }); if (removed.status !== 0) console.error('Manual cleanup required for disposable container: ' + container); }
}
`);

write('scripts/generate-prisma-retention-matrix.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
const auditPath = path.join(root, 'artifacts/product-boundary-audit.json');
if (!fs.existsSync(auditPath)) throw new Error('Run npm run audit:product-boundaries first.');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const evidence = new Map(audit.prisma.models.map((item) => [item.model, item]));
const legacyArchive = new Set(['PublicContentBlock', 'CityGuide', 'ApplicationTimelineWindow', 'SchoolRaw', 'CartItem', 'Order', 'OrderItem', 'Payment', 'PaymentCallbackLog']);
const futurePatterns = /^(Teaching|Agent|Learning|Csca|Student|MockExam|PastPaper|Organization|QuestionSupply|Assessment|ExamScoring|ItemCalibration|ForecastCalibration|Score)/;
const models = [...schema.matchAll(/^model\\s+(\\w+)\\s*\\{([\\s\\S]*?)^\\}/gm)].map((match) => {
  const name = match[1]; const block = match[2]; const item = evidence.get(name) || {};
  const table = block.match(/@@map\\("([^"]+)"\\)/)?.[1] || name;
  let disposition = 'manual-review'; let rationale = 'No direct runtime reference; relation and migration review required.';
  if (!item.reviewCandidate) { disposition = 'runtime-keep'; rationale = 'Referenced by the reachable backend runtime.'; }
  else if (legacyArchive.has(name)) { disposition = 'legacy-archive-candidate'; rationale = 'Belongs to a removed CSCALite public, commerce, payment, or study-abroad domain.'; }
  else if (futurePatterns.test(name)) { disposition = 'future-platform-keep'; rationale = 'Reserved for Agent learning, authoring, assessment, or future teaching platform capability.'; }
  return { model: name, table, disposition, rationale, prismaAccessorMentions: item.prismaAccessorMentions || 0, typeMentions: item.typeMentions || 0 };
});
const counts = models.reduce((result, item) => ({ ...result, [item.disposition]: (result[item.disposition] || 0) + 1 }), {});
const report = { schemaVersion: '1', generatedAt: new Date().toISOString(), policy: 'copy-all-first-prune-later', counts, models };
const dir = path.join(root, 'artifacts'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'prisma-model-retention.json'), JSON.stringify(report, null, 2) + '\\n');
const lines = ['# Prisma model retention matrix', '', 'Policy: copy all models during initial migration; prune only after relation, SQL, migration and rollback review.', '', '| Model | Table | Disposition | Evidence |', '| --- | --- | --- | --- |', ...models.map((item) => '| ' + item.model + ' | ' + item.table + ' | ' + item.disposition + ' | ' + item.rationale + ' |')];
fs.writeFileSync(path.join(dir, 'prisma-model-retention.md'), lines.join('\\n') + '\\n');
console.log(JSON.stringify({ total: models.length, counts }));
`);

let frontendMain = read('frontend/src/main.tsx');
frontendMain = frontendMain.replace("import App from './App';", "import App from './StandaloneAgentApp';");
write('frontend/src/main.tsx', frontendMain);

let agentPage = read('frontend/src/pages/AgentPage.tsx');
agentPage = replaceRequired(
  agentPage,
  "import { FunctionShiftMicroLesson } from './special-practice/adaptive/FunctionShiftMicroLesson';",
  "import { TeachingAssetRenderer } from '../components/agent/TeachingAssetRegistry';",
  'AgentPage teaching asset registry import'
).replaceAll('<FunctionShiftMicroLesson', '<TeachingAssetRenderer').replaceAll('</FunctionShiftMicroLesson>', '</TeachingAssetRenderer>');
write('frontend/src/pages/AgentPage.tsx', agentPage);

let agentApi = read('frontend/src/lib/api-agent.ts');
agentApi = replaceRequired(
  agentApi,
  "  topicTitle: string;\n  title: string;",
  "  capability?: { kind: 'interactive_simulation' | 'animation' | 'video' | string; renderer: string; surface: 'assistant'; preservesPrimaryTask: true; completionChangesMastery: false };\n  topicTitle: string;\n  title: string;",
  'AgentTeachingAsset capability contract'
);
write('frontend/src/lib/api-agent.ts', agentApi);

let viteConfig = read('frontend/vite.config.mjs');
viteConfig = replaceRequired(viteConfig, "import react from '@vitejs/plugin-react';", "import react from '@vitejs/plugin-react';\nimport { resolve } from 'node:path';", 'Vite authoring path import');
if (!/rollupOptions:\s*\{\s*output:\s*\{/.test(viteConfig)) throw new Error('Required extraction transform not found: Vite multi-page inputs');
viteConfig = viteConfig.replace(/rollupOptions:\s*\{\s*output:\s*\{/, "rollupOptions: {\n      input: { agent: resolve(process.cwd(), 'index.html'), authoring: resolve(process.cwd(), 'authoring.html') },\n      output: {");
write('frontend/vite.config.mjs', viteConfig);

let adminConsole = read('frontend/src/components/admin/AdminConsoleShell.tsx');
adminConsole = replaceRequired(
  adminConsole,
  "  const isOrganizationMode = mode === 'organization';",
  "  const isOrganizationMode = mode === 'organization';\n  const isStandaloneAuthoring = window.location.pathname.endsWith('/authoring.html');",
  'authoring shell detection'
);
adminConsole = replaceRequired(
  adminConsole,
  "  const productLabel = isOrganizationMode ? orgShellText('product', '机构控制台') : copy.product;",
  "  const productLabel = isStandaloneAuthoring ? 'Moodlelike Authoring' : isOrganizationMode ? orgShellText('product', '机构控制台') : copy.product;",
  'authoring shell product identity'
);
adminConsole = replaceRequired(
  adminConsole,
  "  const subtitleLabel = isOrganizationMode ? orgShellText('subtitle', 'Organization Console') : copy.subtitle;",
  "  const subtitleLabel = isStandaloneAuthoring ? 'Question & Teaching Studio' : isOrganizationMode ? orgShellText('subtitle', 'Organization Console') : copy.subtitle;",
  'authoring shell subtitle identity'
);
adminConsole = replaceRequired(
  adminConsole,
  "  const groups = isOrganizationMode ? organizationGroups : adminGroups;",
  `  const openAuthoringWorkspace = (workspace: 'questions' | 'teaching-assets') => {
    const url = new URL(window.location.href);
    url.pathname = '/authoring.html';
    url.searchParams.set('workspace', workspace);
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const authoringGroups = [{
    label: '内容生产',
    items: [
      { key: 'aiQuestionBank' as const, label: '题目生产与审核', onClick: () => openAuthoringWorkspace('questions') },
      { key: 'teachingAssets' as const, label: '教学资产管理', onClick: () => openAuthoringWorkspace('teaching-assets') }
    ]
  }];
  const groups = isStandaloneAuthoring ? authoringGroups : isOrganizationMode ? organizationGroups : adminGroups;`,
  'authoring-only navigation groups'
);
write('frontend/src/components/admin/AdminConsoleShell.tsx', adminConsole);

let adminTeachingAssetsPage = read('frontend/src/pages/AdminTeachingAssetsPage.tsx');
adminTeachingAssetsPage = replaceRequired(
  adminTeachingAssetsPage,
  "import { TeachingAssetMicroLesson } from './special-practice/adaptive/FunctionShiftMicroLesson';",
  "import { TeachingAssetRenderer } from '../components/agent/TeachingAssetRegistry';",
  'authoring teaching registry import'
).replaceAll('<TeachingAssetMicroLesson', '<TeachingAssetRenderer').replaceAll('</TeachingAssetMicroLesson>', '</TeachingAssetRenderer>');
write('frontend/src/pages/AdminTeachingAssetsPage.tsx', adminTeachingAssetsPage);

let teachingAssetService = read('backend/src/agent/agent-teaching-asset.service.ts');
teachingAssetService = replaceRequired(
  teachingAssetService,
  "import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';",
  "import { TeachingAssetRoutingOutcomeService } from './teaching-asset-routing-outcome.service';\nimport { getTeachingAssetCapability } from './teaching-asset-registry';",
  'backend teaching asset registry import'
);
teachingAssetService = replaceRequired(
  teachingAssetService,
  "    const payload = parsed.data;\n    return {",
  "    const payload = parsed.data;\n    const capability = getTeachingAssetCapability(payload.component.key, payload.component.version);\n    if (!capability) return null;\n    return {",
  'backend teaching asset capability resolution'
);
teachingAssetService = replaceRequired(
  teachingAssetService,
  "      resolverVersion,\n      topicTitle,",
  "      resolverVersion,\n      capability,\n      topicTitle,",
  'backend teaching asset capability response'
);
write('backend/src/agent/agent-teaching-asset.service.ts', teachingAssetService);

let frontendIndex = read('frontend/index.html');
frontendIndex = frontendIndex.replace(/<title>.*?<\/title>/, '<title>Moodlelike Agent</title>');
write('frontend/index.html', frontendIndex);

const legacyFrontendFiles = [
  'src/App.tsx',
  'src/components/AppRouteRenderer.tsx',
  'src/components/CommerceSkeleton.tsx',
  'src/components/ScrollToTopButton.tsx',
  'src/components/SiteFooter.tsx',
  'src/components/SiteHeader.tsx',
  'src/components/StatusPanel.tsx',
  'src/content/csca-exam.ts',
  'src/content/localized/csca-formulas.ts',
  'src/content/public-site.ts',
  'src/i18n/formatters.ts',
  'src/lib/account-url-state.ts',
  'src/lib/api-commerce.ts',
  'src/lib/api-consulting.ts',
  'src/lib/app-nav-items.ts',
  'src/lib/contact.ts',
  'src/lib/country-options.ts',
  'src/lib/grade-stage-options.ts',
  'src/lib/organization-invites.ts',
  'src/lib/payment.ts',
  'src/lib/school-presentation.ts',
  'src/lib/subject-vocabulary.ts',
  'src/pages/AIServicePage.tsx',
  'src/pages/CartPage.tsx',
  'src/pages/CheckoutPage.tsx',
  'src/pages/ConsultingPage.tsx',
  'src/pages/CscaExamTimePage.tsx',
  'src/pages/CscaPrepPage.tsx',
  'src/pages/CscaSpecialPracticePage.tsx',
  'src/pages/CscaSubjectPage.tsx',
  'src/pages/CscaSubjectVocabularyPage.tsx',
  'src/pages/FeatureComingSoonPage.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/NotFoundPage.tsx',
  'src/pages/OrdersPage.tsx',
  'src/pages/OrganizationInvitePage.tsx',
  'src/pages/PastPaperPages.tsx',
  'src/pages/PublicMePage.tsx',
  'src/pages/SearchPage.tsx',
  'src/styles/ai-service.css',
  'src/styles/ai-service.part-01.css',
  'src/styles/ai-service.part-02.css',
  'src/styles/commerce.css',
  'src/styles/compare.css',
  'src/styles/home.css',
  'src/styles/home.part-01.css',
  'src/styles/home.part-02.css',
  'src/styles/past-papers.css',
  'src/styles/practice.css',
  'src/styles/prep-consulting.css',
  'src/styles/scholarships.css',
  'src/styles/scholarships.part-01.css',
  'src/styles/scholarships.part-02.css',
  'src/styles/school.css',
  'src/styles/school.part-01.css',
  'src/styles/school.part-02.css',
  'src/styles/school.part-03.css',
  'src/styles/school.part-04.css',
  'src/styles/school.part-05.css',
  'src/styles/search.css',
  'src/styles/study-china.css',
  'src/styles/study-china.part-01.css',
  'src/styles/study-china.part-02.css',
  'src/styles/study-china.part-03.css',
  'src/styles/subject-learning.css',
  'src/styles/subject-learning.part-01.css',
  'src/styles/subject-learning.part-02.css',
  'src/styles/subject-learning.part-03.css'
];
const legacyFrontendDirectories = ['src/components/account'];
const frontendSourceRoot = path.resolve(targetRoot, 'frontend', 'src');
function removeLegacyFrontendPath(relativePath, recursive = false) {
  const absolutePath = path.resolve(targetRoot, 'frontend', relativePath);
  if (absolutePath !== frontendSourceRoot && !absolutePath.startsWith(frontendSourceRoot + path.sep)) {
    throw new Error(`Refusing to remove a path outside the standalone frontend source: ${absolutePath}`);
  }
  fs.rmSync(absolutePath, { recursive, force: true });
}
for (const relativePath of legacyFrontendFiles) removeLegacyFrontendPath(relativePath);
for (const relativePath of legacyFrontendDirectories) removeLegacyFrontendPath(relativePath, true);

const legacyBackendDirectories = [
  'src/commerce',
  'src/consulting',
  'src/content',
  'src/payments',
  'src/search',
  'src/study-china'
];
const backendSourceRoot = path.resolve(targetRoot, 'backend', 'src');
for (const relativePath of legacyBackendDirectories) {
  const absolutePath = path.resolve(targetRoot, 'backend', relativePath);
  if (!absolutePath.startsWith(backendSourceRoot + path.sep)) {
    throw new Error(`Refusing to remove a path outside the standalone backend source: ${absolutePath}`);
  }
  fs.rmSync(absolutePath, { recursive: true, force: true });
}

let envExample = read('.env.example')
  .replaceAll('localhost:5432/cscalite', 'localhost:56432/moodlelike')
  .replaceAll('localhost:3000', 'localhost:3100')
  .replaceAll('localhost:5187', 'localhost:5190')
  .replaceAll('cscalite_refresh', 'moodlelike_refresh')
  .replaceAll('cscalite_csrf', 'moodlelike_csrf')
  .replaceAll('cscalite_oauth_state', 'moodlelike_oauth_state');
if (!envExample.includes('VITE_API_BASE_URL=')) {
  envExample += '\n# Standalone Agent application\nVITE_API_BASE_URL="http://localhost:3100"\nVITE_STANDALONE_AGENT="1"\nPORT="3100"\n';
}
write('.env.example', envExample);

let compose = read('docker-compose.yml')
  .replaceAll('name: cscalite', 'name: moodlelike')
  .replaceAll('cscalite-postgres', 'moodlelike-postgres')
  .replaceAll('cscalite-redis', 'moodlelike-redis')
  .replaceAll('POSTGRES_DB: cscalite', 'POSTGRES_DB: moodlelike')
  .replaceAll('55432:5432', '56432:5432')
  .replaceAll('cscalite_postgres_data', 'moodlelike_postgres_data')
  .replaceAll('pg_isready -U postgres -d cscalite', 'pg_isready -U postgres -d moodlelike')
  .replaceAll('${CSC_REDIS_PORT:-56379}', '${MOODLELIKE_REDIS_PORT:-57379}')
  .replaceAll('${CSC_REDIS_PORT:-57379}', '${MOODLELIKE_REDIS_PORT:-57379}');
write('docker-compose.yml', compose);

write('scripts/moodlelike-local.cjs', `const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const command = process.argv[2] || 'start';
const onWindows = process.platform === 'win32';
const npmCommand = onWindows ? 'npm.cmd' : 'npm';
const dockerCommand = onWindows ? 'docker.exe' : 'docker';
const backendUrl = 'http://localhost:3100';
const frontendUrl = 'http://localhost:5190';
const runtimeEnv = {
  ...process.env,
  NODE_ENV: 'development',
  CSC_ENV: 'development',
  PORT: '3100',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:56432/moodlelike?schema=public',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:57379',
  AUTH_SECRET: process.env.AUTH_SECRET || 'moodlelike-local-development-secret-change-before-production',
  CORS_ORIGINS: process.env.CORS_ORIGINS || frontendUrl,
  PUBLIC_APP_ORIGIN: process.env.PUBLIC_APP_ORIGIN || frontendUrl,
  PUBLIC_API_ORIGIN: process.env.PUBLIC_API_ORIGIN || backendUrl,
  VITE_API_BASE_URL: backendUrl,
  VITE_STANDALONE_AGENT: '1',
  AGENT_WEB_ENABLED: 'true',
  VITE_AGENT_WEB_ENABLED: 'true',
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_TARGET_GAP_ENABLED: 'true',
  CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true',
  CSCA_AGENT_PRACTICE_WRITE_ENABLED: 'true',
  CSCA_AGENT_TEACHING_ASSET_ENABLED: 'true'
};

function fail(message) { throw new Error(message); }

function run(label, executable, args, options = {}) {
  process.stdout.write('[moodlelike] ' + label + '\\n');
  const result = spawnSync(executable, args, {
    cwd: options.cwd || root,
    env: runtimeEnv,
    stdio: 'inherit',
    shell: options.shell ?? (onWindows && /\\.cmd$/i.test(executable))
  });
  if (result.error) fail(label + ' failed: ' + result.error.message);
  if ((result.status ?? 1) !== 0) fail(label + ' exited with code ' + result.status + '.');
}

function probe(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, env: runtimeEnv, encoding: 'utf8', shell: onWindows && /\\.cmd$/i.test(executable) });
  return { ok: !result.error && result.status === 0, output: String(result.stdout || result.stderr || '').trim().split(/\\r?\\n/)[0] || null };
}

function dependencyState() {
  return {
    root: fs.existsSync(path.join(root, 'node_modules', '.package-lock.json')),
    backend: fs.existsSync(path.join(root, 'backend', 'node_modules', '.package-lock.json')),
    frontend: fs.existsSync(path.join(root, 'frontend', 'node_modules', '.package-lock.json'))
  };
}

function doctor() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const npm = probe(npmCommand, ['--version']);
  const docker = probe(dockerCommand, ['version', '--format', '{{.Server.Version}}']);
  const compose = probe(dockerCommand, ['compose', 'version', '--short']);
  const dependencies = dependencyState();
  const report = { schemaVersion: '1', node: process.versions.node, nodeSupported: nodeMajor === 22, npm, docker, compose, dependencies };
  console.log(JSON.stringify(report, null, 2));
  if (!report.nodeSupported) fail('Node.js 22 is required.');
  if (!npm.ok) fail('npm is not available.');
  if (!docker.ok || !compose.ok) fail('Docker Desktop with Compose is required and must be running.');
  return report;
}

function ensureDependencies() {
  const state = dependencyState();
  if (!state.root) run('installing root dependencies', npmCommand, ['ci']);
  if (!state.backend) run('installing backend dependencies', npmCommand, ['ci', '--prefix', 'backend']);
  if (!state.frontend) run('installing frontend dependencies', npmCommand, ['ci', '--prefix', 'frontend']);
}

function setup() {
  if (runtimeEnv.NODE_ENV === 'production' || runtimeEnv.CSC_ENV === 'production') fail('Local setup is disabled in production mode.');
  doctor();
  ensureDependencies();
  run('starting isolated PostgreSQL and Redis', dockerCommand, ['compose', 'up', '-d', '--wait', 'postgres', 'redis']);
  run('applying committed database migrations', npmCommand, ['run', 'db:migrate']);
  run('building stable backend runtime', npmCommand, ['run', 'backend:build']);
  run('creating idempotent local demo evidence', process.execPath, [path.join(root, 'scripts', 'agent-demo-seed.cjs'), '--apply']);
  console.log('[moodlelike] local setup complete; no CSCALite database or volume was used.');
}

async function response(url, options = {}) {
  const result = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeoutMs || 10000) });
  const text = await result.text();
  let body = text;
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!result.ok) fail(url + ' returned HTTP ' + result.status + ': ' + text.slice(0, 200));
  return body;
}

async function reachable(url) {
  try { await response(url, { timeoutMs: 1500 }); return true; } catch { return false; }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail('Timed out waiting for ' + url);
}

async function verify() {
  const health = await response(backendUrl + '/api/v1/health');
  if (health.status !== 'ok' || health.service !== 'moodlelike-backend') fail('Unexpected backend identity or health response.');
  const html = await response(frontendUrl + '/zh/agent');
  if (typeof html !== 'string' || !/<html|<!doctype/i.test(html)) fail('Frontend Agent route did not return an HTML shell.');
  const credentialPath = path.join(root, '.local', 'agent-demo-credentials.json');
  if (!fs.existsSync(credentialPath)) fail('Demo credentials are missing. Run npm run local:setup.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = await response(backendUrl + '/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials)
  });
  const token = login.tokens && login.tokens.accessToken;
  if (!token) fail('Demo login did not return an access token.');
  const headers = { authorization: 'Bearer ' + token };
  const me = await response(backendUrl + '/api/v1/auth/me', { headers });
  await response(backendUrl + '/api/v1/agent/conversations', { headers });
  const report = { schemaVersion: '1', verdict: 'pass', backend: health.service, database: 'reachable-through-authenticated-demo', frontend: 'agent-shell-ok', demoUser: me.email || credentials.email };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function start() {
  setup();
  const backendUp = await reachable(backendUrl + '/api/v1/health');
  const frontendUp = await reachable(frontendUrl + '/zh/agent');
  if (backendUp || frontendUp) {
    if (!(backendUp && frontendUp)) fail('Only one Moodlelike service is reachable; free ports 3100 and 5190, then retry.');
    await verify();
    console.log('[moodlelike] services were already running.');
    return;
  }
  const backend = spawn(npmCommand, ['--prefix', 'backend', 'run', 'start:prod'], { cwd: root, env: runtimeEnv, stdio: 'inherit', shell: onWindows });
  const frontend = spawn(npmCommand, ['run', 'frontend:dev'], { cwd: root, env: runtimeEnv, stdio: 'inherit', shell: onWindows });
  const children = [backend, frontend];
  const stop = () => children.forEach((child) => { if (!child.killed) child.kill('SIGTERM'); });
  process.once('SIGINT', () => { stop(); process.exit(130); });
  process.once('SIGTERM', () => { stop(); process.exit(143); });
  const earlyExit = new Promise((_, reject) => children.forEach((child, index) => child.once('exit', (code) => reject(new Error((index ? 'frontend' : 'backend') + ' exited early with code ' + code)))));
  try {
    await Promise.race([Promise.all([waitFor(backendUrl + '/api/v1/health', 90000), waitFor(frontendUrl + '/zh/agent', 90000)]), earlyExit]);
    await verify();
    console.log('[moodlelike] ready: ' + frontendUrl + '/zh/agent');
    await earlyExit;
  } finally {
    stop();
  }
}

Promise.resolve()
  .then(() => {
    if (command === 'doctor') return doctor();
    if (command === 'setup') return setup();
    if (command === 'verify') return verify();
    if (command === 'start') return start();
    fail('Unknown command: ' + command + '. Use doctor, setup, start, or verify.');
  })
  .catch((error) => { console.error('[moodlelike] ' + (error.message || error)); process.exitCode = 1; });
`);

write('scripts/check-local-delivery.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const runner = fs.readFileSync(path.join(root, 'scripts', 'moodlelike-local.cjs'), 'utf8');
const batch = fs.readFileSync(path.join(root, 'start-moodlelike-dev.bat'), 'utf8');
const health = fs.readFileSync(path.join(root, 'backend', 'src', 'health', 'health.controller.ts'), 'utf8');
for (const name of ['local:doctor', 'local:setup', 'local:start', 'local:verify', 'local:acceptance', 'demo:seed']) if (!pkg.scripts[name]) throw new Error('Missing local delivery script: ' + name);
for (const marker of ['docker', 'compose', 'db:migrate', 'backend:build', 'start:prod', 'agent-demo-seed.cjs', '/api/v1/health', '/api/v1/auth/login', '/api/v1/auth/me', '/api/v1/agent/conversations']) if (!runner.includes(marker)) throw new Error('Local runner is missing: ' + marker);
if (!runner.includes('moodlelike-local-development-secret') || !runner.includes("CSC_ENV: 'development'")) throw new Error('Local runner must be explicitly development-only.');
if (!batch.includes('npm run local:start') || batch.includes('scripts\\wait-for-http')) throw new Error('Windows launcher must delegate to the unified local runner.');
if (!health.includes("service: 'moodlelike-backend'")) throw new Error('Health identity must be Moodlelike.');
console.log('Moodlelike local delivery contract passed.');
`);

write('scripts/start-agent-dev.ps1', `$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
& npm.cmd run local:start
exit $LASTEXITCODE
`);

write('start-moodlelike-dev.bat', `@echo off
setlocal
cd /d "%~dp0"
call npm run local:start
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" pause
exit /b %exitCode%
`);

write('LOCAL_DELIVERY.md', `# Moodlelike local delivery

## Command model

- \`npm run local:doctor\`: verify Node.js 22, npm, Docker Desktop/Compose and dependency installation state;
- \`npm run local:setup\`: install missing locked dependencies, start the isolated Moodlelike PostgreSQL/Redis services, deploy committed migrations and create idempotent local demo evidence;
- \`npm run local:start\`: run setup, start backend on 3100 and frontend on 5190, wait for both services, authenticate the dedicated demo user and keep both processes attached to the current terminal;
- \`npm run local:verify\`: verify backend identity, Agent HTML shell, demo authentication and authenticated Agent conversation access against already running services;
- \`npm run local:acceptance\`: run runtime verification, dependency security audit, complete core contracts and all three browser golden paths.

Windows users may double-click \`start-moodlelike-dev.bat\`; it delegates to the same Node runner instead of maintaining a second startup implementation.

## Isolation and safety

The local environment uses Compose project \`moodlelike\`, PostgreSQL port 56432, Redis port 57379, database \`moodlelike\`, and its own named volume. Local setup rejects production mode, and the demo seed rejects non-loopback database hosts. It never reads the CSCALite environment file, database, Docker volume or uploads.

The generated demo credentials live under ignored \`.local/\` and are never printed by the verifier. The default local auth secret is development-only and must never be used for deployment.

Legacy \`CSCA_*\` feature flags remain internal compatibility contracts for the extracted runtime. Operators use the Moodlelike commands above and do not need to set them manually.

## Expected URLs

- Student Agent: \`http://localhost:5190/zh/agent\`
- Backend health: \`http://localhost:3100/api/v1/health\`
- PostgreSQL: \`localhost:56432\`
- Redis: \`localhost:57379\`

Stop the foreground command with Ctrl+C. PostgreSQL and Redis remain available for the next run; stop them explicitly with \`docker compose stop\` when desired.

## Verified rehearsal

The Windows rehearsal passed Docker/Compose doctor checks, deployed all 97 migrations, reran with no pending migrations, seeded the dedicated demo fixtures idempotently, started the stable compiled backend plus Vite frontend, passed both in-run and independent authenticated verification, and released application ports after Ctrl+C. PostgreSQL and Redis intentionally remained healthy for the next local run.
`);

write('README.md', `# Moodlelike Agent

Moodlelike Agent 是从 CSCALite 中独立出的 AI 原生训练与教学产品。当前以可信做题训练为核心，逐步接入学习辅助、教学资产、独立验证、教师与机构能力。

## 当前边界

- 学生只面对一条持续学习旅程；
- Agent 聊天始终存在，类型化工作区负责做题、真题、教学和验证；
- 真实作答、辅助曝光和教学验证进入统一学习证据；
- 当前保留 CSCALite 的训练、模考、真题、学习智能和题目供应内核；
- 原公开站、咨询、支付和通用内容路由不再由后端根模块加载；
- 前端使用 Agent 专用应用壳，只装配 Agent、登录注册、首次设置和个人/学习设置；
- 尚未物理删除的旧源码不再进入 Agent 前端构建图，后续按依赖审计分批清理。

## 本地启动

1. 检查本机条件：

   \`\`\`powershell
   npm run local:doctor
   \`\`\`

2. 一键启动（会按 lockfile 安装缺失依赖、启动独立数据库、执行迁移并生成本地演示数据）：

   \`\`\`powershell
   .\\start-moodlelike-dev.bat
   \`\`\`

   或运行 \`npm run local:start\`。

3. 服务启动后可单独验收：\`npm run local:verify\`。完整交付验收使用 \`npm run local:acceptance\`。

默认地址：前端 \`http://localhost:5190/zh/agent\`，后端 \`http://localhost:3100\`，PostgreSQL \`localhost:56432\`。

完整说明见 [LOCAL_DELIVERY.md](./LOCAL_DELIVERY.md)。

## 独立性

- 使用独立目录、依赖安装和构建产物；
- 使用独立 Docker Compose 项目、数据库、数据卷和端口；
- 不复制 CSCALite 的 \`.env\`、本地上传、构建产物或 \`node_modules\`；
- CSCALite 后续不会被新项目的开发命令修改。

详细边界见 [EXTRACTION_STATUS.md](./EXTRACTION_STATUS.md) 和 [长期演进 ADR](./Labs/docs/83-AI-NATIVE-TRAINING-TO-LEARNING-PLATFORM-ADR.md)。
`);

write('EXTRACTION_STATUS.md', `# Agent 产品独立状态

## 已完成：Phase 1 可运行隔离

- 新仓库根目录与独立 package identity；
- 独立前后端启动端口；
- 独立 PostgreSQL、Redis 容器名称、端口和数据卷；
- 默认前端入口切换到 Agent；
- 后端根模块只装配 Agent 所需的认证、个人设置、训练、模考、真题、学习智能和健康检查；
- 保留完整 Prisma 迁移历史，避免切断现有 Agent 数据契约；
- 排除密钥、本地数据、上传、依赖和构建产物。

## 已完成：Phase 2A Agent 专用前端壳

- \`StandaloneAgentApp\` 取代通用站点 \`App\` 成为前端入口；
- 只保留 Agent、登录注册、首次学习档案和个人/学习设置四类路由；
- 未识别路径统一回到 Agent，不再进入公开站或旧训练页面；
- 四类工作区按路由懒加载；
- 旧公开站和后台页面不再进入生产构建图，但源码暂时保留以便审计后删除。
- 个人设置已替换为轻量账号页，只保留显示名、邮箱验证、密码重置、机构、额度和退出；学习目标与学习方式继续留在 Agent 学习设置。

## 已完成：Phase 2B 前端生产边界清理

- 从 \`src/main.tsx\` 追踪静态导入、动态导入、再导出和 CSS 引用，并输出可审计报告；
- 初始报告为 290 个源文件、76 个生产可达、214 个不可达；
- 已从独立项目物理删除 71 个明确属于旧公共站、商城、咨询、旧账户中心和旧训练入口的文件；
- 清理后为 219 个源文件、76 个生产可达、143 个保留但不可达；
- 后台内容生产工作台和教学/模拟动画源码暂时保留，作为题目运营控制面与未来教学能力候选，不混入学生生产构建；
- \`test:minimal\` 已改为独立产品边界测试，不再校验 CSCALite 旧首页。

## 仍然保留的兼容代码

剩余不可达文件主要是后台内容生产工作台和教学可视化资产。它们未进入学生端生产构建，但直接删除会提前丢失未来题库运营、教学动画和模拟教学能力，因此应在后续拆成独立 admin/authoring 入口或 teaching-asset 包后再决定去留。

## Phase 2C 建议

1. 为内容生产建立独立 admin/authoring 入口，避免与学生 Agent 入口混合；
2. 将教学动画收敛为 teaching-asset registry，并从聊天区按事件打开；
3. 将训练、题库、学习证据和教学资产重命名为通用领域模块；
4. 按 Prisma 模型实际引用拆出 Agent schema 基线；
5. 建立从 CSCALite 到 Moodlelike 的一次性数据迁移和回滚脚本；
6. 为独立仓库建立 Agent 黄金路径 CI。

## 已完成：Phase 2C 第一轮领域边界

- 前端已分为 76 个学生 Agent 文件、91 个 admin/authoring 文件和 52 个 teaching-assets 文件；
- 后端从 \`AppModule\` 出发共 207 个运行可达文件；
- 已删除完全不可达且不属于产品未来方向的商城、支付、咨询、留学内容、搜索和旧公开内容模块，共 24 个后端文件；
- \`ops\` 与 \`score-calibration\` 暂时保留，等待控制面与学习评估边界确认；
- Prisma 共 147 个模型，静态审计筛出 34 个复核候选；未自动删除任何模型或迁移；
- 详细职责写入 \`PRODUCT_BOUNDARIES.md\`，机器可读证据写入 \`artifacts/product-boundary-audit.json\`。

## 已完成：Phase 2D Teaching Asset Registry

- 三种已审核交互模拟统一注册为带版本的 capability；
- Agent 页面不再直接依赖具体微课组件，统一通过 \`TeachingAssetRenderer\` 分发；
- 后端下发 \`capability\`，明确资产类型、展示面、主任务保持和掌握度规则；
- 主任务存在时教学内容留在聊天辅助面，做题区与进度不被替换；
- 未知资产使用可恢复 fallback，不会导致 Agent 页面崩溃；
- 新增跨前后端 registry 契约测试与 \`TEACHING_ASSET_REGISTRY.md\`。

## 已完成：Phase 2E 独立 Authoring 入口

- 新增独立 \`authoring.html\` 与 \`AuthoringApp\`，由 Vite 作为第二个 HTML 入口构建；
- 第一阶段只提供题目生产/审核/发布和教学资产管理两个工作区；
- Authoring 工作区按需加载，学生 \`main.tsx\` 不导入 Authoring；
- 未登录用户在 Authoring 内登录，非管理员显示拒绝页；
- 题目和教学资产 API 均继续由服务端 \`RequiredAdminGuard\` 保护；
- 控制面使用精简导航，不恢复 CSCALite 旧后台的其他业务入口；
- 详细边界见 \`AUTHORING_BOUNDARY.md\`。

## 已完成：Phase 2F CI 与黄金路径

- 新增独立项目 GitHub Actions；
- contracts 门禁覆盖构建、Agent runtime、学生入口、教学资产、Authoring 和产品边界审计；
- 浏览器黄金路径覆盖推荐任务做题、做题中打开教学、Authoring 发布教学资产；
- 浏览器测试使用确定性 fixture，不依赖真实模型、用户数据或 CSCALite 数据库；
- 失败时上传 Playwright trace、截图与边界审计报告；
- 详细说明见 \`CI_GOLDEN_PATHS.md\`。

## 已完成：Phase 3A 数据迁移安全基线

- 生成 Prisma 模型保留矩阵，初次迁移坚持 \`copy-all-first-prune-later\`，不根据静态引用直接删表；
- 提供独立的迁移 plan/apply 与 rollback plan/apply 命令，默认只输出计划，不连接或修改数据库；
- apply 要求源、目标数据库显式配置，并要求确认值与目标数据库名完全一致；
- 默认只允许本机目标；远程目标必须额外显式开启，且回滚执行同样的限制；
- 迁移前先备份目标，再导出源库、恢复至目标，并写入可审计 manifest；
- 回滚只能使用同一迁移目录内、目标身份完全匹配的备份；
- 命令参数不经 shell 展开，日志中的连接密码会被遮蔽；
- CI 只运行策略自测和模型矩阵生成，不执行真实迁移。

本阶段没有读取、写入或删除任何真实业务数据。操作步骤与演练门禁见 \`DATA_MIGRATION_RUNBOOK.md\`。

## 已完成：Phase 3B 隔离迁移与精确回滚演练

- 使用专用临时 PostgreSQL 16 容器和两个纯测试数据库完成演练，不复用开发数据库、容器或数据卷；
- 在源测试库完整部署 97 条 Prisma 迁移，得到 149 张 public 表（含 Prisma 记录表和测试探针）；
- 迁移后源/目标表数量一致，源探针 2 行完整复制，目标迁移前哨兵表被清除；
- 回滚后目标哨兵恢复为 1 行，迁移源探针表完全消失，证明回滚是精确替换而非叠加恢复；
- 发现并修复 Prisma \`schema=public\` URL 参数与 \`pg_dump\` 不兼容的问题；
- 迁移和回滚在恢复前显式重建目标 \`public\` schema，避免 \`pg_restore --clean\` 遗留额外对象；
- 临时容器已删除；匿名容器文件系统不可恢复，测试 dump、manifest 与脱敏证据保留在独立项目的 \`.local\`/\`artifacts\` 中；
- 可重复命令为 \`npm run data:rehearsal:plan\` 和 \`npm run data:rehearsal:apply\`。

演练证据见 \`artifacts/phase3b-data-rehearsal.json\`。本阶段仍未连接或复制真实 CSCALite 业务数据。

## 已完成：Phase 3C 数据质量体检与切换门禁

- 新增只读 \`npm run data:preflight\`，在 \`BEGIN READ ONLY\` 中检查 PostgreSQL 版本、关键表、Prisma 失败迁移、未验证约束、序列落后和表规模快照；
- 报告只包含数据库身份、结构与聚合数字，不导出用户行或业务内容，连接凭据会被遮蔽；
- PostgreSQL 低于 16、关键表缺失、失败迁移、意外的未验证约束或序列落后均会阻断切换；
- 两条历史 forecast \`NOT VALID\` 约束按精确名称登记为已知遗留警告，其他新增未验证约束仍阻断；
- 隔离演练已证明健康基线通过、人为加入的未验证约束被阻断、移除异常后重新通过；
- 切换条件、冻结窗口、失败处置与回退决策见 \`DATA_CUTOVER_CHECKLIST.md\`；业务不变量见 \`DATA_INVARIANTS.md\`。

本阶段仍未连接真实业务数据库；执行真实 preflight 需要用户显式提供只读连接。

## 已完成：Phase 3D 独立发布基线

- 根、后端、前端和 question-engine 统一为 Moodlelike package identity 与 \`0.1.0-alpha.1\`；
- 锁文件中的 CSCALite workspace 元数据同步收口，Node.js 基线固定为 22；
- 新增 \`VERSION\`、私有源码许可提示、Security Policy、环境契约、Release Baseline 和 Git 属性；
- 来源声明不再暴露本机绝对路径，并明确独立仓库采用新的 Git 历史；
- 环境审计只扫描当前可达运行时，生成不含变量值的清单，并阻止示例文件出现疑似真实 secret；
- 发布门禁拒绝真实 \`.env\`、dump、私钥、缺失关键文档和包身份漂移；
- 旧 \`CSCA_*\`/\`CSCALITE_*\` 名称作为兼容契约保留，后续采用 alias/deprecation 迁移，不做破坏性批量重命名。

## 已完成：Phase 4A 干净检出可复现性验证

- 从首个独立提交 \`b362288\` 创建无硬链接干净克隆，不复用独立项目目录中的依赖或构建产物；
- 在干净克隆中分别执行根、后端和前端三段 \`npm ci\`，锁文件安装全部成功；
- 在干净克隆中执行完整 \`npm run ci:contracts\`，前后端构建、Prisma 生成、Agent runtime、壳层、教学资产、迁移策略、边界审计、环境审计和发布检查全部通过；
- \`v0.1.0-alpha.1\` 标签指向实际接受该验证的提交；
- 安装期 npm audit 观察到后端 10 项、前端 8 项上游依赖风险，未执行可能造成破坏性升级的自动修复，转入独立供应链治理阶段。

详细证据和复现命令见 \`CLEAN_CHECKOUT_VERIFICATION.md\`。

## 已完成：Phase 4B 非破坏性供应链修复

- 后端 Nest 保持 11.x、Express 保持 4.x，前端 Vite 保持 7.x，不采用强制主版本升级；
- 直接依赖升级到 Nest 11.2.5、Express 4.22.3、Vite 7.3.6，并刷新锁文件允许范围内的传递依赖；
- Multer、body-parser、qs、fast-uri、js-yaml、brace-expansion、Babel、PostCSS、esbuild、nanoid 等风险链均更新到修复版本；
- 后端和前端 \`npm audit\` 均由非零风险降至 0；
- 新增 \`npm run security:audit-dependencies\`，GitHub CI 在构建与浏览器测试前阻断新增 high/critical 风险；
- 动态注册表审计不并入本地离线 \`ci:contracts\`，以保持核心契约可离线复现。

详细矩阵见 \`SUPPLY_CHAIN_STATUS.md\`。

## 已完成：Phase 4C alpha.2 发布验收

- 从候选提交 \`973ff57\` 创建无硬链接干净克隆并执行根、后端、前端三段 \`npm ci\`；
- 三段安装与独立安全门禁均报告 0 个已知漏洞；
- 干净克隆完整 \`ci:contracts\` 通过；
- 学生任务创建、做题不中断的教学辅助、独立 Authoring 发布三条浏览器黄金路径全部通过；
- 已创建不可变标签 \`v0.1.0-alpha.2\`，指向 \`973ff57\`；
- 未配置远程仓库、未推送，也未连接真实业务数据库。

## 已完成：Phase 5A 独立本地交付入口

- 新增统一 Node 编排器，Windows 批处理、PowerShell 与 npm 均委托同一实现；
- \`local:doctor\` 检查 Node.js 22、npm、Docker Compose 和依赖安装状态；
- \`local:setup\` 只操作 Moodlelike 的数据库、缓存、迁移和幂等演示数据；
- \`local:start\` 启动前后端、等待健康、验证产品身份和专用演示账号，并保持进程附着便于 Ctrl+C 停止；
- \`local:verify\` 覆盖健康、Agent 壳、登录、当前用户和会话 API；
- \`local:acceptance\` 串联真实运行验证、安全审计、核心契约和三条浏览器黄金路径；
- 后端健康身份改为 \`moodlelike-backend\`，演示账号与演示资产不再使用 CSCALite/CSCAPilot 品牌；
- 本地交付静态契约纳入 \`ci:contracts\`。

真实 Windows 彩排已完成：Docker 环境检查通过；97 条迁移成功部署且重复执行无待处理项；演示数据幂等生成；稳定后端与 Vite 前端成功启动；启动器内验证和独立 \`local:verify\` 均返回 pass；停止后 3100/5190 无监听残留。彩排过程中修复了带空格 Node 路径被 shell 截断、旧 backend watcher 自重启导致健康超时两项问题。

## 已完成：Phase 5B alpha.3 发布验收

- 从候选提交 \`6f5904f\` 创建无硬链接干净克隆，不复用现有依赖、构建产物或工作区状态；
- 根、后端和前端三段 \`npm ci\` 全部成功，安装与独立安全审计均报告 0 个已知漏洞；
- 本地交付静态契约、完整 \`ci:contracts\` 和发布身份检查全部通过；
- 学生训练、做题不中断的教学联动、独立 Authoring 发布三条浏览器黄金路径全部通过；
- 已创建不可变标签 \`v0.1.0-alpha.3\`，指向 \`6f5904f\`；
- 标签纳入一键 Windows 本地交付、隔离基础设施、幂等演示数据与运行验证能力；未配置远程仓库、未推送，也未连接真实业务数据库。

## 已完成验证

- 根、后端和前端依赖均在本目录独立安装；
- \`npm run agent:build\` 通过；
- \`npm --prefix backend run test:agent-runtime\` 通过；
- \`npm --prefix frontend run test:minimal\` 通过；
- \`npm --prefix frontend run test:standalone-shell\` 通过；
- \`npm --prefix frontend run audit:standalone-reachability\` 已生成审计报告；
- \`npm run audit:product-boundaries\` 已生成前端、后端与 Prisma 边界报告；
- \`npm run test:teaching-assets\` 通过；
- \`npm run test:authoring-boundary\` 通过；
- \`npm run test:ci-contract\` 通过；
- \`npm run test:data-migration-policy\` 通过；
- \`npm run audit:prisma-retention\` 已生成模型保留矩阵；
- \`npm run data:rehearsal:apply\` 已完成隔离迁移与回滚闭环；
- \`npm run test:data-preflight-policy\` 与隔离环境中的 clean/blocked 双探针通过；
- \`npm run audit:environment-contract\` 和 \`npm run release:check\` 通过；
- 构建链已固定跨包题目引擎产物位置，生产入口为 \`backend/dist/backend/src/main.js\`。

当前后端与前端锁文件安全审计均为 0 个已知漏洞；动态注册表门禁仍需在每个候选版本重新运行。
`);

write('PRODUCT_BOUNDARIES.md', `# Moodlelike 产品代码边界

## 1. 学生 Agent 运行面

- 唯一前端生产入口：\`frontend/src/main.tsx -> StandaloneAgentApp\`；
- 学生可进入 Agent、认证、首次档案和个人设置；
- 做题、学习计划、学习历程、错题薄弱点、真题与学习设置均属于 Agent 工作区；
- 当前生产依赖由 \`frontend/artifacts/standalone-reachability.json\` 给出。

## 2. Admin / Authoring 控制面

- 题目生成、审核、发布、教学资产管理和运营审计属于控制面；
- 代码可以暂时保留，但不得从学生入口加载；
- 后续应建立独立入口、独立权限门和独立构建，而不是恢复 CSCALite 通用站点路由器。

## 3. Teaching assets 教学资产面

- 动画、交互模拟、微课和视频是可被 Agent 调度的教学资产；
- 教学资产不能取代或打断做题区，应由聊天区触发并在独立辅助面板展示；
- 下一步需建立统一 registry、能力元数据、知识点映射和打开事件契约。

## 4. 后端运行边界

- 后端只从 \`AppModule\` 装配认证、个人设置、训练、模考、真题、学习智能、Agent 与健康检查；
- 商城、支付、咨询、留学内容、搜索和旧公开内容模块已从独立项目物理移除；
- \`ops\` 与 \`score-calibration\` 暂时保留，分别等待控制面和学习评估边界确认。

## 5. 数据边界

- Prisma schema 暂时保持迁移兼容，不根据静态扫描自动删表；
- \`artifacts/product-boundary-audit.json\` 记录模型引用证据和复核候选；
- 模型删除必须同时满足：运行不可达、无关系依赖、无原始 SQL、无迁移/回滚需求、迁移演练通过。

## 6. 可重复审计

\`npm --prefix frontend run audit:standalone-reachability\`

\`npm run audit:product-boundaries\`
`);

write('TEACHING_ASSET_REGISTRY.md', `# Teaching Asset Registry

## 目标

教学资产是 Agent 可调度的学习能力，不是新的课程页面。学生始终保留聊天上下文；存在做题任务时，教学内容出现在聊天辅助面，主任务状态与答题进度保持不变。

## 当前注册能力

| Registry key | 类型 | 展示面 |
| --- | --- | --- |
| \`math.function-horizontal-shift@1\` | 交互模拟 | assistant |
| \`physics.newton-second-law@1\` | 交互模拟 | assistant |
| \`chemistry.acid-base-neutralization@1\` | 交互模拟 | assistant |

## 契约

- 后端只下发已注册且已发布、已审核、版本匹配的资产；
- 前端只通过 \`TeachingAssetRenderer\` 查找具体渲染器；
- 未知组件显示可恢复的 fallback，不关闭聊天或当前任务；
- \`preservesPrimaryTask = true\`；
- \`completionChangesMastery = false\`，完成教学后必须使用新题独立验证；
- 打开、参数变化、即时问题和完成状态继续写入教学互动事件。

## 扩展新类型

新增动画或视频时，需要同时完成：后端 payload schema、后端 capability registry、前端 renderer registry、管理端审核预览、互动事件策略和契约测试。不得在 AgentPage 内新增按组件名判断的分支。
`);

write('AUTHORING_BOUNDARY.md', `# Authoring 控制面边界

## 独立入口

- 学生端：\`/index.html\` 或本地化 Agent 路径；
- 内容生产端：\`/authoring.html\`；
- 两个入口由 Vite 分别构建，学生入口不导入 AuthoringApp。

## 第一阶段工作区

- 题目生产、审核与发布；
- 教学资产创建、预览、审核、发布与效果观察。

用户、机构、商城、支付、公开内容和旧训练后台不属于 Authoring 第一阶段。

## 权限

- 前端只向 \`role=admin\` 展示工作区；
- 未登录用户在 Authoring 入口内完成登录；
- 非管理员只能看到拒绝页，不能加载工作区；
- 服务端题目与教学资产接口继续使用 \`RequiredAdminGuard\`，前端权限不作为安全边界。

## 导航与发布

- Authoring 使用独立精简导航，不恢复 CSCALite 通用后台路由；
- 两个工作区按需加载；
- 生产环境可将 \`authoring.html\` 放在独立域名或受 VPN/Zero Trust 保护的路径，API 权限规则保持不变。
`);

write('CI_GOLDEN_PATHS.md', `# CI 与黄金路径

## 分层门禁

### Contracts

\`npm run ci:contracts\`

执行完整构建、后端 Agent runtime、学生入口边界、Teaching Asset Registry、Authoring 权限边界、CI 自检以及产品边界审计。该层不依赖外部模型、真实用户数据或生产数据库。

### Browser golden paths

\`npm run ci:golden\`

使用 Chromium 和拦截式确定性 fixture 验证：

1. 推荐任务在 Agent 内创建并打开做题区；
2. 做题区保持挂载时，教学资产在聊天区打开；
3. 管理员从独立 Authoring 入口发布已审核教学资产。

## GitHub Actions

\`.github/workflows/standalone-ci.yml\` 在 push 和 pull request 时安装三层依赖、安装 Chromium、运行 contracts 与三条浏览器黄金路径。失败时上传 Playwright trace、截图和边界审计报告。

## 非目标

- CI 不调用付费模型 Provider；
- CI 不连接 CSCALite 数据库或数据卷；
- CI 不使用本地 demo 凭据；
- 真数据库迁移演练和模型 Provider 评测属于后续 release gate。
`);

write('DATA_MIGRATION_RUNBOOK.md', `# CSCALite → Moodlelike 数据迁移运行手册

## 当前策略

第一次迁移完整复制现有 Prisma schema 中的全部模型和数据。模型保留矩阵只提供审计结论，不授权删表；裁剪必须在独立项目稳定运行、关系/原始 SQL/历史迁移复核以及回滚演练全部通过之后单独进行。

## 安全保证

- 所有命令默认是 plan-only；只有带 \`--apply\` 的 npm 脚本才执行数据库工具；
- 源库和目标库必须不同，目标数据库名需要二次精确确认；
- 默认拒绝远程目标，确需远程执行时必须显式设置 \`ALLOW_REMOTE_MOODLELIKE_TARGET=1\`；
- apply 顺序固定为：备份目标、导出源库、重建目标 \`public\` schema、恢复到目标、完成 manifest；
- 回滚只能选择 \`.local/data-migrations/<run>/manifest.json\`，并校验目标身份和同目录备份；
- 回滚同样先重建目标 \`public\` schema，确保删除迁移后新增而旧备份中不存在的对象；
- 连接字符串不会写入 manifest，控制台输出会遮蔽用户名和密码；
- \`.local\` 被 Git 忽略，dump 和 manifest 不进入版本库。

## 前置条件

1. 本机安装与数据库版本兼容的 \`pg_dump\` 和 \`pg_restore\`；
2. 目标数据库已经创建，目标账号拥有建表、删表和恢复所需权限；
3. 先运行 \`npm run ci:contracts\`；
4. 在一次性或隔离环境完成首次演练，不直接把首次 apply 指向生产库。

## 生成审计材料

\`npm run audit:product-boundaries\`

\`npm run audit:prisma-retention\`

结果位于 \`artifacts/prisma-model-retention.json\` 和 \`artifacts/prisma-model-retention.md\`。

## 迁移计划（不接触数据库）

在当前 PowerShell 会话设置变量：

\`$env:CSCALITE_SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@localhost:55432/cscalite'\`

\`$env:MOODLELIKE_TARGET_DATABASE_URL='postgresql://USER:PASSWORD@localhost:56432/moodlelike'\`

\`$env:CONFIRM_MOODLELIKE_TARGET_DATABASE='moodlelike'\`

然后运行：

\`npm run data:migrate:plan\`

计划输出必须显示正确的源/目标身份和四个步骤，且密码应被遮蔽。

## 迁移执行（会修改目标库）

确认目标是可覆盖的独立 Moodlelike 数据库后运行：

\`npm run data:migrate:apply\`

成功后保存输出的 manifest 路径。每次执行产生独立目录，不覆盖其他演练记录。

## 回滚计划与执行

先预览：

\`npm run data:rollback:plan -- --manifest=.local/data-migrations/<run-id>/manifest.json\`

确认目标身份和备份文件正确后执行：

\`npm run data:rollback:apply -- --manifest=.local/data-migrations/<run-id>/manifest.json\`

回滚使用迁移前目标备份，会覆盖目标库当前对象；它不会修改 CSCALite 源库。

## Phase 3B 演练验收

- 在一次性数据库完成 apply、应用启动、关键表行数/外键抽查和三条 Agent 黄金路径；
- 使用同一 manifest 完成 rollback；
- 回滚后重新核对目标快照与应用可启动性；
- 演练证据中不得包含连接密码、用户隐私或数据库 dump；
- 未通过以上门禁前，不执行真实生产切换，也不裁剪 Prisma schema。

可重复的本机隔离演练：

\`npm run data:rehearsal:plan\`

\`npm run data:rehearsal:apply\`

apply 会创建唯一命名的临时 PostgreSQL 16 容器和两个测试数据库，部署全部迁移、验证精确复制、执行回滚、验证目标原状，并在结束时删除该临时容器。它不使用 \`moodlelike-postgres\` 或现有数据卷。
`);

write('DATA_INVARIANTS.md', `# 数据迁移不变量

## 自动阻断项

\`npm run data:preflight\` 使用只读事务检查：

- PostgreSQL 主版本不得低于 16；
- public schema 必须存在且不能为空；
- Prisma 迁移不得存在 \`finished_at IS NULL AND rolled_back_at IS NULL\` 的失败记录；
- 用户、学生档案、Agent 会话/消息/产物、学习证据、题目、自适应轮次、教学资产与真题关键表必须全部存在；
- 不得出现未登记的 \`NOT VALID\` 约束；
- 任何受表字段拥有的序列不得落后于当前字段最大值。

## 已知遗留约束

以下约束为 forecast 历史数据兼容而保持 \`NOT VALID\`，但仍约束所有新写入；体检将其报告为 warning：

- \`forecast_calibration_snapshots_qualified_source_check\`；
- \`ck_forecast_verified_manifest_required\`。

不得按模式、表名或数量宽泛放行新的未验证约束；新增例外必须说明历史原因、验证计划和移除条件，并更新策略测试。

## 聚合快照

体检保存数据库大小、public 表数和 \`pg_stat_user_tables\` 近似行数，用于迁移前后差异审查。报告不读取或保存用户明细、题目内容、附件内容、token、密码哈希或 Provider 密钥。

核心表为空默认是 warning：新环境可能为空，但真实 CSCALite 迁移出现空的 users、csca_questions 或 agent_conversations 时必须由负责人确认。
`);

write('DATA_CUTOVER_CHECKLIST.md', `# 数据切换与回退清单

## A. 切换前

- [ ] 明确源库、目标库、负责人、执行人、观察人和回退决策人；
- [ ] 使用只读账号对源库执行 \`npm run data:preflight\`，结果为 passed；
- [ ] 记录源库 preflight artifact、Prisma migration 数量、public 表数和数据库大小；
- [ ] 在同版本 PostgreSQL 上完成最新一次 \`npm run data:rehearsal:apply\`；
- [ ] 确认目标库允许覆盖，目标数据库名二次确认无误；
- [ ] 确认 \`pg_dump\`/\`pg_restore\` 与服务端版本兼容；
- [ ] 冻结会产生新学习证据、答题、会话、附件和内容发布的写操作；
- [ ] 等待后台任务、outbox、生成任务和正在进行的训练轮次达到约定静止状态；
- [ ] 保留旧应用与旧数据库，不删除源库或原数据卷。

## B. 执行窗口

1. 冻结后再次运行源库 preflight；
2. 运行 \`npm run data:migrate:plan\` 并由第二人核对脱敏后的源/目标身份；
3. 运行 \`npm run data:migrate:apply\`，保存 manifest 路径；
4. 对目标运行 \`npm run data:preflight\`；
5. 对比源/目标：迁移记录、public 表数、数据库大小和核心表近似行数；
6. 使用目标数据库启动 Moodlelike 后端；
7. 验证登录、今日任务、开始/恢复做题、提交答案、学习历程、错题薄弱点、教学资产和 Authoring 读取；
8. 写入一个切换后测试用户/会话并验证新学习证据只进入目标库；
9. 观察错误率、请求延迟、数据库连接、后台任务和 outbox；
10. 达到观察窗口后再解除写冻结。

## C. 必须回退

出现以下任一情况立即停止放量并回退：目标 preflight blocked、关键表或迁移记录不一致、认证失败、当前学习无法恢复、答案/证据不能持久化、错误率持续超过约定阈值、出现源目标双写或数据继续写入旧库。

回退顺序：停止新应用写入 → 记录故障时间与最后成功写入 → 使用对应 manifest 运行 rollback plan → 双人确认目标身份 → 运行 rollback apply → 恢复旧应用指向旧库 → 验证旧路径 → 保存日志与脱敏证据。

## D. 不可在同一窗口执行

- 不裁剪 Prisma schema 或历史迁移；
- 不删除 CSCALite 源库、volume、备份或上传文件；
- 不升级 PostgreSQL、Prisma 或认证协议；
- 不同时上线新的 Agent 学习逻辑；
- 不使用生产凭据填充 Issue、聊天记录或版本库文件。
`);

write('VERSION', `0.1.0-alpha.3
`);

write('.nvmrc', `22
`);

write('.node-version', `22
`);

write('.gitattributes', `* text=auto
*.bat text eol=crlf
*.ps1 text eol=crlf
*.sh text eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.woff binary
*.woff2 binary
*.ttf binary
*.pdf binary
`);

write('LICENSE', `Moodlelike Source-Available Notice

No open-source license is granted for this repository at this time.
All rights are reserved by the project owner. The source may not be copied,
modified, redistributed, sublicensed, or offered as a service without written
permission from the project owner.

Before any external distribution, replace this notice with a license approved
by the project owner and legal counsel.
`);

write('SECURITY.md', `# Security policy

## Reporting

Do not open a public issue containing credentials, database URLs, private student data, question-bank contents, attachments, Provider keys, dumps or exploit details. Report security issues privately to the repository owner through the approved internal channel.

## Secrets and student data

- Commit only \`.env.example\` and \`.env.production.example\`;
- never commit \`.env\`, \`.local\`, database dumps, uploads, logs or private keys;
- use separate secrets for authentication, organization BYOK encryption, Provider access and operational endpoints;
- rotate a credential immediately if it appears in Git history or an external system;
- migration evidence must contain only schema and aggregate counts.

## Supported baseline

The current supported prerelease is \`0.1.0-alpha.3\` on Node.js 22 and PostgreSQL 16. This is not yet a public production support commitment.
`);

write('ENVIRONMENT_CONTRACT.md', `# Environment contract

## Required in production

- \`DATABASE_URL\`: dedicated Moodlelike PostgreSQL database;
- \`AUTH_SECRET\`: long, random signing secret unique to this deployment;
- \`CORS_ORIGINS\`: exact permitted web origins;
- \`PUBLIC_APP_ORIGIN\`: canonical student application origin;
- \`PUBLIC_API_ORIGIN\`: canonical API origin.

Redis, SMTP, Google OAuth, model Providers, organization BYOK, attachments and operational endpoints are optional capabilities. Enabling one requires its corresponding credentials and rollout checks; unused credentials should remain unset.

Variables exposed through \`VITE_*\` are public browser configuration and must never contain secrets. Provider keys, SMTP passwords, auth secrets and operational tokens are server-only.

The machine-generated inventory at \`artifacts/environment-contract.md\` lists every direct environment reference reachable from the current Agent runtime. Variables not present in examples rely on code defaults and are compatibility debt, not implicitly required production configuration.

Legacy \`CSCA_*\`, \`CSCALITE_*\` and \`CSC_ENV\` names remain versioned compatibility contracts. They should be renamed only through an explicit alias/deprecation migration, never by a broad search-and-replace.
`);

write('RELEASE_BASELINE.md', `# Release baseline 0.1.0-alpha.3

This prerelease establishes the first independently buildable Moodlelike Agent repository baseline.

## Included

- standalone student Agent and independent Authoring entry;
- Teaching Asset Registry;
- Agent runtime, question supply, assessment, learning evidence and recovery services;
- isolated PostgreSQL/Redis defaults;
- contract CI and three browser golden paths;
- Prisma retention matrix, safe migration/rollback tooling, disposable migration rehearsal and read-only data preflight;
- environment inventory, secret hygiene gate and source provenance.
- zero-known-vulnerability backend/frontend lockfiles at the Phase 4B audit point and a high/critical CI dependency gate.
- one-command Windows local delivery with isolated PostgreSQL/Redis defaults, idempotent demo seeding, runtime verification and an acceptance workflow.

## Required release gates

\`npm run ci:contracts\`

\`npm run security:audit-dependencies\`

\`npm run ci:golden\`

\`npm run data:rehearsal:apply\`

Real data migration additionally requires an explicitly authorized source preflight and the checklist in \`DATA_CUTOVER_CHECKLIST.md\`.

## Known compatibility debt

- runtime environment names and internal CSCA domain types retain legacy prefixes;
- Prisma initially copies all 147 models; archive candidates are not deleted;
- root operational scripts still include retained question-production and migration utilities and require a later allowlist cleanup;
- this prerelease is private and carries no open-source grant.
`);

write('CLEAN_CHECKOUT_VERIFICATION.md', `# Clean checkout verification

## Accepted baseline

- Version: \`0.1.0-alpha.1\`
- Commit: \`b362288\`
- Tag: \`v0.1.0-alpha.1\`
- Verification date: 2026-09-17
- Platform: Windows, Node.js 22 / npm 10 contract

## Method

The repository was cloned with \`git clone --no-hardlinks\` into a new temporary directory. The verification did not reuse source-workspace or target-workspace \`node_modules\`, build output, \`.local\` state, database dumps, or Git metadata.

The following installation path completed from committed lockfiles:

\`npm ci\`

\`npm ci --prefix backend\`

\`npm ci --prefix frontend\`

The clean clone then passed:

\`npm run ci:contracts\`

This includes frontend and backend builds, Prisma Client generation, Agent runtime tests, standalone shell contracts, Teaching Asset Registry, Authoring boundary, CI contract, data migration and preflight policy tests, reachability and product-boundary audits, Prisma retention, environment inventory, and the release baseline gate.

## Supply-chain observation

The installation audit reported 10 backend dependency findings (4 moderate, 6 high) and 8 frontend dependency findings (2 low, 2 moderate, 4 high) at verification time. These counts are registry observations rather than proof of runtime exploitability. No automatic \`npm audit fix\` was applied because it may change locked major versions or runtime behavior.

Before a public or production release, classify each finding by reachable production path, patch non-breaking items, explicitly document accepted exceptions with expiry, and rerun this clean-checkout gate.

Phase 4B subsequently resolved these observed findings through same-major direct upgrades and lockfile-compatible transitive updates. Current backend and frontend audits report zero known vulnerabilities; see \`SUPPLY_CHAIN_STATUS.md\`.

## Scope limit

This gate proves repository and lockfile reproducibility for the core contract suite. Browser golden paths, live providers, production credentials, and real-data migration remain separate gates.

## Alpha.2 acceptance

Commit \`973ff57\` was independently cloned and passed deterministic installation, zero-vulnerability dependency auditing, the complete core contract suite, and all three browser golden paths. It is tagged \`v0.1.0-alpha.2\`.

## Alpha.3 acceptance

Commit \`6f5904f\` was independently cloned without hardlinks and passed all three locked installations, the local-delivery contract, zero-vulnerability dependency auditing, the complete core contract suite, and all three browser golden paths. It is tagged \`v0.1.0-alpha.3\`.
`);

write('SUPPLY_CHAIN_STATUS.md', `# Supply-chain security status

## Phase 4B result

On 2026-09-17 the committed dependency graph was upgraded without forced major-version changes:

| Area | Before | After | Direct baseline |
| --- | ---: | ---: | --- |
| Backend | 10 findings | 0 findings | Nest 11.2.5, Express 4.22.3 |
| Frontend | 8 findings | 0 findings | Vite 7.3.6 |

Latest accepted release tag: \`v0.1.0-alpha.3\` at commit \`6f5904f\`. The dependency graph remains the zero-known-vulnerability baseline accepted at alpha.2.

Important remediated transitive versions include Multer 2.4.0, body-parser 1.20.8, qs 6.16.0, fast-uri 3.1.8, js-yaml 4.3.2, browserslist 4.29.0, brace-expansion 1.1.21, esbuild 0.28.2, PostCSS 8.5.28, nanoid 3.3.19, Babel Core 7.29.7 and fflate 0.8.3.

## Gate

Run:

\`npm run security:audit-dependencies\`

The command audits backend and frontend lockfiles and fails for high or critical findings. The standalone GitHub workflow runs it after deterministic installation and before browser setup/build verification.

The dynamic registry audit remains separate from \`ci:contracts\` so the local core contract suite stays reproducible when offline. A new advisory may fail CI without a source change; triage it by production reachability, apply the smallest compatible update, rerun all contracts and golden paths, and document any time-limited exception rather than using \`npm audit fix --force\`.
`);

write('SOURCE_PROVENANCE.md', `# Source provenance

Initial extraction source: the private CSCALite workspace supplied by the project owner.

Extraction baseline date: 2026-09-17

This repository was created by the versioned extraction program in \`scripts/extract-agent-product.cjs\`. It intentionally starts with new Git history and does not copy source secrets, local databases, uploads, dependency directories, build artifacts, or original Git metadata.
`);

console.log(JSON.stringify({ sourceRoot, targetRoot, status: 'extracted' }, null, 2));
