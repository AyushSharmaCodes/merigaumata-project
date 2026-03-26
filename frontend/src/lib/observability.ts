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
