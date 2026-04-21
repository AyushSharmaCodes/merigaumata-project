import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import i18n from "@/i18n/config";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id"> & {
  error?: unknown;
  defaultTitleKey?: string;
  defaultMessageKey?: string;
  skipNormalization?: boolean;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function getToastText(value?: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(getToastText).filter(Boolean).join(" ").trim();
  }

  return "";
}

function isGenericErrorTitle(titleText: string): boolean {
  const normalized = titleText.trim().toLowerCase();
  if (!normalized) return true;

  const genericTitles = [
    i18n.t("common.error"),
    i18n.t("errors.auth.errorOccurred"),
    i18n.t("errors.titles.oops"),
    "error",
    "an error occurred",
  ]
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);

  return genericTitles.includes(normalized);
}

function normalizeToastProps(props: Toast): Omit<ToasterToast, "id"> {
  const {
    error,
    defaultTitleKey = ErrorMessages.AUTH_NOTICE,
    defaultMessageKey = ErrorMessages.AUTH_ERROR_OCCURRED,
    skipNormalization = false,
    ...toastProps
  } = props;

  if (skipNormalization || toastProps.variant !== "destructive") {
    return toastProps;
  }

  const titleText = getToastText(toastProps.title);
  const descriptionText = getToastText(toastProps.description);
  const translation = i18n.t.bind(i18n);
  const fallbackErrorSource =
    descriptionText || (!isGenericErrorTitle(titleText) ? titleText : undefined);
  const errorSource = error ?? fallbackErrorSource;
  const normalizedDescription =
    descriptionText ||
    getErrorMessage(errorSource ?? defaultMessageKey, translation, defaultMessageKey);
  const normalizedTitle =
    !titleText || isGenericErrorTitle(titleText)
      ? getFriendlyTitle(error ?? normalizedDescription, translation, defaultTitleKey)
      : toastProps.title;

  return {
    ...toastProps,
    title: normalizedTitle,
    description: normalizedDescription,
  };
}

function toast({ ...props }: Toast) {
  const id = genId();
  const normalizedProps = normalizeToastProps(props);

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...normalizedProps,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
