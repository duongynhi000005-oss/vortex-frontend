import { secureLogger } from "@/lib/secureLogging";
import { loadJSON, saveJSON } from "@/lib/persist";
import type { NotificationPreferences } from "@/store/notificationPreferences";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface NotificationIntent {
  status: string;
  title: string;
  body: string;
  href: string;
}

export interface NotificationHistoryEntry extends NotificationIntent {
  id: string;
  timestamp: number;
}

export const NOTIFICATION_HISTORY_CAP = 50;
const HISTORY_STORAGE_KEY = "vx.notifications.history";

let history: NotificationHistoryEntry[] = [];
let historyLoaded = false;
const historyListeners = new Set<() => void>();

function ensureHistoryLoaded(): void {
  if (historyLoaded) return;
  historyLoaded = true;
  const stored = loadJSON<NotificationHistoryEntry[]>(HISTORY_STORAGE_KEY, []);
  history = Array.isArray(stored) ? stored.slice(0, NOTIFICATION_HISTORY_CAP) : [];
}

function persistHistory(): void {
  saveJSON(HISTORY_STORAGE_KEY, history);
}

function emitHistoryChange(): void {
  for (const listener of historyListeners) listener();
}

export function getNotificationHistory(): NotificationHistoryEntry[] {
  ensureHistoryLoaded();
  return history;
}

export function subscribeNotificationHistory(listener: () => void): () => void {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

export function clearNotificationHistory(): void {
  ensureHistoryLoaded();
  history = [];
  persistHistory();
  emitHistoryChange();
}

function recordHistory(intent: NotificationIntent): void {
  ensureHistoryLoaded();
  const entry: NotificationHistoryEntry = {
    ...intent,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  // Newest first; evict oldest entries past the cap.
  history = [entry, ...history].slice(0, NOTIFICATION_HISTORY_CAP);
  persistHistory();
  emitHistoryChange();
}

export function buildNotificationBody(intent: NotificationIntent, showDetails: boolean): string {
  return showDetails ? intent.body : intent.title;
}

export function decideChannels(
  prefs: NotificationPreferences,
  intent: NotificationIntent,
  now: Date = new Date(),
): { toast: boolean; browser: boolean; sound: boolean } {
  const decision = {
    toast: prefs.channels.toast && prefs.statuses[intent.status] !== false,
    browser: prefs.channels.browser && prefs.statuses[intent.status] !== false,
    sound: prefs.channels.sound && prefs.statuses[intent.status] !== false,
  };

  const suppressed = isQuietHours(prefs, now) || (!decision.toast && !decision.browser && !decision.sound);
  if (suppressed) {
    return { toast: false, browser: false, sound: false };
  }

  // Record only notifications that are actually dispatched.
  recordHistory(intent);
  return decision;
}

function isQuietHours(prefs: NotificationPreferences, now: Date): boolean {
  const { quietStart, quietEnd } = prefs;
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = quietStart.split(":").map(Number);
  const [eh, em] = quietEnd.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export function dispatchNotification(prefs: NotificationPreferences, intent: NotificationIntent): void {
  const channels = decideChannels(prefs, intent);
  if (!channels.toast && !channels.browser && !channels.sound) return;
  const body = buildNotificationBody(intent, prefs.showDetails);
  if (channels.browser && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(intent.title, { body });
    } catch (error) {
      secureLogger.warn("Failed to show browser notification", error);
    }
  }
}
