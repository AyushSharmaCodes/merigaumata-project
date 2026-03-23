import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/config';
import i18next from 'i18next';
import { ErrorMessages } from './constants/messages/ErrorMessages';
import * as Sentry from "@sentry/react";

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    integrations: [
        Sentry.browserTracingIntegration(),
        // Replay is great for seeing HOW a user encountered a bug
        Sentry.replayIntegration({
            maskAllText: true, // Privacy first: masks sensitive input
            blockAllMedia: true,
        }),

    ],
    // 1.0 in dev, usually 0.1 in high-traffic production
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Capture 100% of sessions that result in an error
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
});

// Add a breadcrumb for the initial app load
Sentry.addBreadcrumb({
    category: "lifecycle",
    message: "Application Mounted",
    level: "info",
    data: {
        url: window.location.pathname,
        search: window.location.search,
        timestamp: new Date().toISOString()
    }
});

createRoot(document.getElementById('root')!).render(
    <Sentry.ErrorBoundary fallback={<p className="text-center p-4">{i18next.t(ErrorMessages.UNEXPECTED_ERROR_BOUNDARY)}</p>}>
        <App />
    </Sentry.ErrorBoundary>
);
