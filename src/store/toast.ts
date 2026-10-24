import { create } from "zustand";
import { parseInternalHref, parseExternalUrl } from "@/lib/inputs";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  href?: string;
};

export const TOAST_DURATION_MS = 4000;

type TimerEntry = {
  timeoutId: ReturnType<typeof setTimeout>;
  remainingMs: number;
  startedAt: number;
};

// Kept outside the store's state since timers are an implementation detail,
// not something components should read reactively.
const timers = new Map<string, TimerEntry>();

type ToastState = {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, href?: string) => string;
  dismissToast: (id: string) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
};

function sanitizeToastHref(href?: string): string | undefined {
  if (!href) return undefined;
  if (parseInternalHref(href) || parseExternalUrl(href)) return href;
  return undefined;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, variant = "info", href) => {
    const id = crypto.randomUUID();
    const validHref = sanitizeToastHref(href);
    set({
      toasts: [
        ...get().toasts,
        { id, message, variant, ...(validHref ? { href: validHref } : {}) },
      ],
    });
    timers.set(id, {
      timeoutId: setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS),
      remainingMs: TOAST_DURATION_MS,
      startedAt: Date.now(),
    });
    return id;
  },

  dismissToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timers.delete(id);
    }
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  pauseToast: (id) => {
    const timer = timers.get(id);
    if (!timer) return;
    clearTimeout(timer.timeoutId);
    timer.remainingMs = Math.max(timer.remainingMs - (Date.now() - timer.startedAt), 0);
  },

  resumeToast: (id) => {
    const timer = timers.get(id);
    if (!timer) return;
    timer.startedAt = Date.now();
    timer.timeoutId = setTimeout(() => get().dismissToast(id), timer.remainingMs);
  },
}));
