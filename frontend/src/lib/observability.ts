interface BackgroundTaskOptions {
  timeout?: number;
}

type BackgroundTaskHandle = number | null;

declare global {
  interface Window {
    requestIdleCallback: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback: (handle: number) => void;
  }
}

let observabilityInitPromise: Promise<void> | null = null;

export const scheduleBackgroundTask = (
  task: () => void,
  { timeout = 2000 }: BackgroundTaskOptions = {}
): (() => void) => {
  if (typeof window === "undefined") {
    task();
    return () => undefined;
  }

  let idleHandle: BackgroundTaskHandle = null;
  let timeoutHandle: BackgroundTaskHandle = null;

  const runTask = () => {
    if (idleHandle !== null && window.cancelIdleCallback) {
      window.cancelIdleCallback(idleHandle);
      idleHandle = null;
    }

    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    task();
  };

  if (window.requestIdleCallback) {
    idleHandle = window.requestIdleCallback(runTask, { timeout });
  }

  timeoutHandle = window.setTimeout(runTask, timeout);

  return () => {
    if (idleHandle !== null && window.cancelIdleCallback) {
      window.cancelIdleCallback(idleHandle);
    }

    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
  };
};

export const initializeObservability = async (): Promise<void> => {
  if (!import.meta.env.PROD) {
    return;
  }

  if (observabilityInitPromise) {
    return observabilityInitPromise;
  }

  observabilityInitPromise = (async () => {
    const setupTasks: Promise<unknown>[] = [];

    if (import.meta.env.VITE_SENTRY_DSN) {
      setupTasks.push(
        import("@sentry/react").then((Sentry) => {
          Sentry.init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            environment: import.meta.env.MODE,
            enabled: true,
            integrations: [
              Sentry.browserTracingIntegration(),
              Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
              }),
            ],
            tracesSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,
            replaysSessionSampleRate: 0.1,
          });

          Sentry.addBreadcrumb({
            category: "lifecycle",
            message: "Application Mounted",
            level: "info",
            data: {
              url: window.location.pathname,
              search: window.location.search,
              timestamp: new Date().toISOString(),
            },
          });
        })
      );
    }

    const {
      getMissingNewRelicEnvKeys,
      initializeNewRelic,
      isNewRelicBrowserConfigured,
    } = await import("@/utils/newrelic");

    if (isNewRelicBrowserConfigured()) {
      setupTasks.push(
        Promise.resolve().then(() => {
          initializeNewRelic();
        })
      );
    } else if (import.meta.env.VITE_NEW_RELIC_LICENSE_KEY) {
      const missingKeys = getMissingNewRelicEnvKeys();
      console.warn(
        `[observability] Skipping New Relic browser init. Missing env: ${missingKeys.join(", ")}`
      );
    }

    await Promise.allSettled(setupTasks);
  })();

  return observabilityInitPromise;
};
