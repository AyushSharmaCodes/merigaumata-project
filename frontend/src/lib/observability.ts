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
    const {
      getMissingNewRelicEnvKeys,
      initializeNewRelic,
      isNewRelicBrowserConfigured,
    } = await import("@/utils/newrelic");

    if (isNewRelicBrowserConfigured()) {
      initializeNewRelic();
    } else if (import.meta.env.VITE_NEW_RELIC_LICENSE_KEY) {
      const missingKeys = getMissingNewRelicEnvKeys();
      console.warn(
        `[observability] Skipping New Relic browser init. Missing env: ${missingKeys.join(", ")}`
      );
    }
  })();

  return observabilityInitPromise;
};
