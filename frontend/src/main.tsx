import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import i18next, { initI18n } from './i18n/config';
import { ErrorMessages } from './constants/messages/ErrorMessages';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeObservability, scheduleBackgroundTask } from './lib/observability';

await initI18n;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallback={<p className="text-center p-4">{i18next.t(ErrorMessages.UNEXPECTED_ERROR_BOUNDARY)}</p>}>
    <App />
  </ErrorBoundary>
);

scheduleBackgroundTask(() => {
  void initializeObservability();
}, { timeout: 3000 });
