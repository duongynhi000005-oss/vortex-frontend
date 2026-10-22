import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type NotifiableStatus = "accepted" | "filled" | "failed";
export const NOTIFIABLE_STATUSES: readonly NotifiableStatus[] = ["accepted", "filled", "failed"];

export type NotificationPreferences = {
  statuses: Record<NotifiableStatus, boolean>;
  channels: { toast: boolean; browser: boolean; sound: boolean };
  /** "HH:MM" local time; quiet hours are disabled when either is empty. */
  quietStart: string;
  quietEnd: string;
  batchWindowMs: number;
  /** Include amounts/tokens in browser notification bodies. Off by default for privacy. */
  showDetails: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  statuses: { accepted: true, filled: true, failed: true },
  channels: { toast: true, browser: false, sound: false },
  quietStart: "",
  quietEnd: "",
  batchWindowMs: 1000,
  showDetails: false,
};

export const NOTIFICATION_PREFS_KEY = "vortex-notification-prefs";
export const NOTIFICATION_PREFS_VERSION = 1;

/** Maximum number of dispatched notifications retained in the local inbox. */
export const NOTIFICATION_HISTORY_LIMIT = 50;

export type NotificationHistoryEntry = {
  id: string;
  status: NotifiableStatus;
  title: string;
  body: string;
  /** Intent link derived from buildNotificationBody, if any. */
  href?: string;
  /** Epoch milliseconds when the notification was dispatched. */
  timestamp: number;
};

type State = NotificationPreferences & {
  history: NotificationHistoryEntry[];
  update: (patch: Partial<NotificationPreferences>) => void;
  reset: () => void;
  recordHistory: (entry: NotificationHistoryEntry) => void;
  clearHistory: () => void;
};

export const useNotificationPreferences = create<State>()(
  persist(
    (set) => ({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      history: [],
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_NOTIFICATION_PREFERENCES),
      recordHistory: (entry) =>
        set((state) => ({
          history: [entry, ...state.history].slice(0, NOTIFICATION_HISTORY_LIMIT),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: NOTIFICATION_PREFS_KEY,
      version: NOTIFICATION_PREFS_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Unknown/older versions fall back to defaults rather than guessing.
      migrate: () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, history: [] }),
      partialize: ({ update: _update, reset: _reset, recordHistory: _record, clearHistory: _clear, ...prefs }) => prefs,
    },
  ),
);
