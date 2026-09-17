import React from 'react';
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
