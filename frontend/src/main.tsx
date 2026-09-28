import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider } from './i18n/I18nProvider';
import './styles.css';

async function mount() {
  const isAdminPath = /^\/admin(?:\/|$)/.test(window.location.pathname);
  const module = isAdminPath ? await import('./AdminApp') : await import('./StandaloneAgentApp');
  const App = module.default;

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}

void mount();
