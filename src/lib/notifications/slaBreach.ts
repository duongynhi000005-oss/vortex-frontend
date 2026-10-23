import { SLA_THRESHOLDS, type FillTimePercentiles, type SlaPanelData } from "@/lib/analytics";
import { decideChannels, type NotificationIntent } from "@/lib/notifications/dispatcher";
import type { NotificationPreferences } from "@/store/notificationPreferences";
import { useToastStore } from "@/store/toast";
import { secureLogger } from "@/lib/secureLogging";
import type { MessageKey, MessageValues } from "@/lib/i18n";

export type SlaPercentileKey = "p50" | "p90" | "p99";

export type SlaPassState = Record<SlaPercentileKey, boolean>;

export interface SlaBreachEvent {
  percentile: SlaPercentileKey;
  value: number;
  threshold: number;
}

export interface TransitionDetectionResult {
  transitions: SlaBreachEvent[];
  nextState: SlaPassState;
}

export const DEFAULT_SLA_PASS_STATE: SlaPassState = {
  p50: true,
  p90: true,
  p99: true,
};

/**
 * Detect transitions from passing (true) to failing (false) for each SLA percentile.
 *
 * Requirements:
 * 1. Only emits an event when previousState[p] === true and currentSla[p] === false (pass -> fail).
 * 2. Sustained failure (false -> false) emits nothing (anti-spam on repeated renders).
 * 3. Recovery (false -> true) resets the tracker to true, re-arming for future breaches.
 */
export function detectSlaBreachTransitions(
  previousState: SlaPassState,
  currentSla: SlaPassState,
  percentiles: FillTimePercentiles,
  thresholds = SLA_THRESHOLDS,
): TransitionDetectionResult {
  const keys: SlaPercentileKey[] = ["p50", "p90", "p99"];
  const transitions: SlaBreachEvent[] = [];
  const nextState: SlaPassState = { ...previousState };

  for (const key of keys) {
    const wasPassing = previousState[key] ?? true;
    const isPassing = currentSla[key];

    nextState[key] = isPassing;

    if (wasPassing && !isPassing) {
      const thresholdKey = `${key}MaxSeconds` as keyof typeof thresholds;
      const threshold = thresholds[thresholdKey];
      const value = percentiles[key];
      transitions.push({
        percentile: key,
        value,
        threshold,
      });
    }
  }

  return { transitions, nextState };
}

/**
 * Format SLA breach notification body with localized fallback.
 */
export function buildSlaBreachBody(
  event: SlaBreachEvent,
  t?: (key: MessageKey, values?: MessageValues) => string,
): string {
  const valStr = event.value.toFixed(1);
  const key = `notifications.slaBreach.${event.percentile}` as MessageKey;
  if (t) {
    try {
      const translated = t(key, {
        value: valStr,
        threshold: event.threshold,
      });
      if (translated && translated !== key) {
        return translated;
      }
    } catch {
      // Fallback below
    }
  }
  return `${event.percentile.toUpperCase()} fill time exceeded SLA (${valStr}s > ${event.threshold}s)`;
}

/**
 * Build the notification title for an SLA breach.
 */
export function buildSlaBreachTitle(
  t?: (key: MessageKey, values?: MessageValues) => string,
): string {
  if (t) {
    try {
      const translated = t("notifications.slaBreach.title" as MessageKey);
      if (translated && translated !== "notifications.slaBreach.title") {
        return translated;
      }
    } catch {
      // Fallback below
    }
  }
  return "SLA Threshold Breached";
}

/**
 * Build a standard NotificationIntent for the SLA breach.
 */
export function buildSlaBreachNotificationIntent(
  event: SlaBreachEvent,
  t?: (key: MessageKey, values?: MessageValues) => string,
): NotificationIntent {
  return {
    status: "failed",
    title: buildSlaBreachTitle(t),
    body: buildSlaBreachBody(event, t),
    href: "/analytics",
  };
}

/**
 * Dispatches an SLA breach alert using toast and/or browser notification channels,
 * adhering strictly to user notification preferences, quiet hours, and channel enablement.
 */
export function notifySlaBreach(
  event: SlaBreachEvent,
  prefs: NotificationPreferences,
  t?: (key: MessageKey, values?: MessageValues) => string,
  now: Date = new Date(),
): { toast: boolean; browser: boolean; sound: boolean } {
  const intent = buildSlaBreachNotificationIntent(event, t);
  const channels = decideChannels(prefs, intent, now);

  if (channels.toast) {
    useToastStore.getState().addToast(intent.body, "error", intent.href);
  }

  if (
    channels.browser &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(intent.title, { body: intent.body });
    } catch (error) {
      secureLogger.warn("Failed to show browser notification for SLA breach", error);
    }
  }

  return channels;
}
