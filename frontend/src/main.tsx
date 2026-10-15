import React, { useLayoutEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { AppLoadingState } from './components/AppLoadingState';
import { I18nProvider } from './i18n/I18nProvider';
import './styles.css';

function BootReady() {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('app-boot-pending', 'app-boot-private');
  }, []);
  return null;
}

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <React.StrictMode>
      <I18nProvider>
        <BootReady />
        {children}
      </I18nProvider>
    </React.StrictMode>
  );
}

async function mount() {
  const isAdminPath = /^\/admin(?:\/|$)/.test(window.location.pathname);
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isPublicSeoPath = normalizedPath === '/'
    || normalizedPath === '/about'
    || normalizedPath === '/csca-prep';
  const root = ReactDOM.createRoot(document.getElementById('root')!);

  if (!isPublicSeoPath) {
    root.render(
      <AppProviders>
        <AppLoadingState variant={window.location.pathname === '/agent' ? 'auth' : isAdminPath ? 'admin' : 'page'} />
      </AppProviders>
    );
  }

  const module = isAdminPath ? await import('./AdminApp') : await import('./StandaloneAgentApp');
  const App = module.default;

  root.render(
    <AppProviders>
      <App />
    </AppProviders>
  );
}

void mount();
