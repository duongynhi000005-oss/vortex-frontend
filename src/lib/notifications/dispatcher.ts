import { secureLogger } from "@/lib/secureLogging";
import { loadJSON, saveJSON } from "@/lib/persist";
import type { NotifiableStatus, NotificationPreferences } from "@/store/notificationPreferences";
import type { FeedItem } from "@/lib/types";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export type DispatchContext = {
  prefs: NotificationPreferences;
  status: FeedItem["status"];
  visible: boolean;
  isLeader: boolean;
  permission: NotificationPermissionState;
  now: Date;
};

export type ChannelDecision = { toast: boolean; browser: boolean; sound: boolean };

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

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function isQuietHours(start: string, end: string, now: Date): boolean;
export function isQuietHours(prefs: NotificationPreferences, now: Date): boolean;
export function isQuietHours(
  startOrPrefs: string | NotificationPreferences,
  endOrNow?: string | Date,
  maybeNow?: Date,
): boolean {
  let start: string;
  let end: string;
  let now: Date;

  if (typeof startOrPrefs === "object") {
    start = startOrPrefs.quietStart;
    end = startOrPrefs.quietEnd;
    now = (endOrNow as Date) ?? new Date();
  } else {
    start = startOrPrefs;
    end = (endOrNow as string) ?? "";
    now = maybeNow ?? new Date();
  }

  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function buildNotificationBody(
  items: FeedItem[],
  showDetails: boolean,
): { title: string; body: string; href: string };
export function buildNotificationBody(
  intent: NotificationIntent,
  showDetails: boolean,
): string;
export function buildNotificationBody(
  intentOrItems: NotificationIntent | FeedItem[],
  showDetails: boolean,
): string | { title: string; body: string; href: string } {
  if (Array.isArray(intentOrItems)) {
    const items = intentOrItems;
    if (items.length > 1) {
      return { title: "Vortex", body: `${items.length} of your intents updated`, href: "/my-intents" };
    }
    const item = items[0] as FeedItem;
    const body = showDetails
      ? `${item.srcAmount} ${item.srcToken} → ${item.dstToken} is now ${item.status}`
      : `Intent ${item.id.slice(0, 8)} is now ${item.status}`;
    return { title: "Vortex", body, href: `/explore/${item.id}` };
  }

  return showDetails ? intentOrItems.body : intentOrItems.title;
}

/**
 * Resolve whether sound is enabled for a given status. Falls back to the
 * legacy flat `channels.sound` boolean when no per-status entry exists, so
 * existing users keep their prior all-on/all-off preference.
 */
export function isSoundEnabledForStatus(prefs: NotificationPreferences, status: string): boolean {
  const perStatus = prefs.channels.soundByStatus;
  if (perStatus && typeof perStatus[status as NotifiableStatus] === "boolean") {
    return perStatus[status as NotifiableStatus];
  }
  return prefs.channels.sound;
}

export function decideChannels(ctx: DispatchContext): ChannelDecision;
export function decideChannels(
  prefs: NotificationPreferences,
  intent: NotificationIntent,
  now?: Date,
): ChannelDecision;
export function decideChannels(
  ctxOrPrefs: DispatchContext | NotificationPreferences,
  intent?: NotificationIntent,
  now: Date = new Date(),
): ChannelDecision {
  if ("prefs" in ctxOrPrefs && "status" in ctxOrPrefs) {
    // Pure context decision for live intents
    const { prefs, status, visible, isLeader, permission, now: ctxNow } = ctxOrPrefs;
    if (status === "pending" || !prefs.statuses[status as NotifiableStatus]) {
      return { toast: false, browser: false, sound: false };
    }
    const quiet = isQuietHours(prefs.quietStart, prefs.quietEnd, ctxNow);

    if (visible) {
      return { toast: prefs.channels.toast, browser: false, sound: prefs.channels.sound && !quiet };
    }
    const browser = prefs.channels.browser && permission === "granted" && isLeader && !quiet;
    return {
      toast: prefs.channels.toast && !browser,
      browser,
      sound: false,
    };
  }

  // Intent-based decision
  const prefs = ctxOrPrefs as NotificationPreferences;
  const targetIntent = intent!;
  const statusEnabled = prefs.statuses[targetIntent.status as NotifiableStatus] !== false;
  const decision: ChannelDecision = {
    toast: prefs.channels.toast && statusEnabled,
    browser: prefs.channels.browser && statusEnabled,
    sound: isSoundEnabledForStatus(prefs, targetIntent.status) && statusEnabled,
  };

  const suppressed = isQuietHours(prefs, now) || (!decision.toast && !decision.browser && !decision.sound);
  if (suppressed) {
    return { toast: false, browser: false, sound: false };
  }

  // Record only notifications that are actually dispatched.
  recordHistory(targetIntent);
  return decision;
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

/**
 * Build a clearly-labeled sample intent used by the "Send test notification"
 * button. It flows through the same decideChannels/buildNotificationBody
 * pipeline as a real update, so quiet hours and channel config are respected.
 */
export function buildTestNotificationIntent(): NotificationIntent {
  return {
    status: "test",
    title: "Test: Vexa notification",
    body: "Test: This is a sample notification to verify your notification settings.",
    href: "/settings",
  };
}

export function sendTestNotification(prefs: NotificationPreferences): void {
  dispatchNotification(prefs, buildTestNotificationIntent());
}
