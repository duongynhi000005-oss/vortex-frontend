"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { NOTIFIABLE_STATUSES, useNotificationPreferences } from "@/store/notificationPreferences";
import {
  clearNotificationHistory,
  dispatchNotification,
  getNotificationHistory,
  subscribeNotificationHistory,
  type NotificationPermissionState,
} from "@/lib/notifications/dispatcher";

const inputClass = "bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-sm text-vx-text";

const EMPTY_HISTORY: ReturnType<typeof getNotificationHistory> = [];

function useNotificationHistory() {
  return useSyncExternalStore(
    subscribeNotificationHistory,
    getNotificationHistory,
    () => EMPTY_HISTORY,
  );
}

export function NotificationSettings() {
  const { t } = useTranslation();
  const prefs = useNotificationPreferences();
  const history = useNotificationHistory();
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  // Permission is only ever requested from this click handler (a user gesture).
  const toggleBrowser = async (enabled: boolean) => {
    if (enabled && permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      prefs.update({ channels: { ...prefs.channels, browser: result === "granted" } });
      return;
    }
    prefs.update({ channels: { ...prefs.channels, browser: enabled && permission === "granted" } });
  };

  // Fires a sample notification through the same dispatch pipeline as a real
  // update, so users can verify their configured channels (and quiet hours).
  const sendTestNotification = () => {
    dispatchNotification({
      id: `test-${Date.now()}`,
      status: "pending",
      title: t("notifications.test.title"),
      body: t("notifications.test.body"),
      href: "/",
      timestamp: Date.now(),
    });
  };

  return (
    <fieldset className="space-y-2 text-xs text-vx-muted">
      <legend className="font-medium mb-1">{t("notifications.title")}</legend>

      <div role="group" aria-label={t("notifications.statuses")} className="flex flex-wrap gap-3">
        {NOTIFIABLE_STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-1.5 capitalize">
            <input
              type="checkbox"
              checked={prefs.statuses[status]}
              onChange={(e) => prefs.update({ statuses: { ...prefs.statuses, [status]: e.target.checked } })}
            />
            {status}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={prefs.channels.toast}
          onChange={(e) => prefs.update({ channels: { ...prefs.channels, toast: e.target.checked } })}
        />
        {t("notifications.channel.toast")}
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={prefs.channels.browser}
          disabled={permission === "unsupported" || permission === "denied"}
          onChange={(e) => void toggleBrowser(e.target.checked)}
          aria-describedby="notify-permission-hint"
        />
        {t("notifications.channel.browser")}
      </label>
      {(permission === "unsupported" || permission === "denied") && (
        <p id="notify-permission-hint" className="text-vx-dim">
          {t(permission === "denied" ? "notifications.permission.denied" : "notifications.permission.unsupported")}
        </p>
      )}
      <div role="group" aria-label={t("notifications.channel.sound")} className="space-y-1">
        <span className="block">{t("notifications.channel.sound")}</span>
        <div className="flex flex-wrap gap-3">
          {NOTIFIABLE_STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-1.5 capitalize">
              <input
                type="checkbox"
                checked={prefs.channels.sound[status]}
                onChange={(e) =>
                  prefs.update({
                    channels: {
                      ...prefs.channels,
                      sound: { ...prefs.channels.sound, [status]: e.target.checked },
                    },
                  })
                }
              />
              {status}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={prefs.showDetails} onChange={(e) => prefs.update({ showDetails: e.target.checked })} />
        {t("notifications.showDetails")}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          {t("notifications.quietStart")}
          <input type="time" value={prefs.quietStart} onChange={(e) => prefs.update({ quietStart: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          {t("notifications.quietEnd")}
          <input type="time" value={prefs.quietEnd} onChange={(e) => prefs.update({ quietEnd: e.target.value })} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        {t("notifications.batchWindow")}
        <select
          value={prefs.batchWindowMs}
          onChange={(e) => prefs.update({ batchWindowMs: Number(e.target.value) })}
          className={inputClass}
        >
          {[1000, 5000, 15000].map((ms) => (
            <option key={ms} value={ms} className="bg-vx-ink text-vx-text">
              {ms / 1000}s
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={sendTestNotification}
        className="rounded-md border border-vx-border bg-vx-surface px-2 py-1 text-sm text-vx-text hover:bg-vx-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-accent"
      >
        {t("notifications.test.button")}
      </button>

      <section aria-label={t("notifications.inbox.title")} className="pt-2 border-t border-vx-border space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t("notifications.inbox.title")}</h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => clearNotificationHistory()}
              className="text-vx-dim hover:text-vx-text underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-accent rounded"
            >
              {t("notifications.inbox.clear")}
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-vx-dim">{t("notifications.inbox.empty")}</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {history.map((entry) => (
              <li key={entry.id}>
                <a
                  href={entry.href}
                  className="block rounded px-1 py-0.5 hover:bg-vx-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-accent"
                >
                  <span className="text-vx-text">{entry.title}</span>
                  <span className="block text-vx-dim">{new Date(entry.timestamp).toLocaleString()}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </fieldset>
  );
}
