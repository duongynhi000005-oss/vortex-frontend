import { useEffect, useRef } from "react";
import type { SlaPanelData } from "@/lib/analytics";
import {
  detectSlaBreachTransitions,
  notifySlaBreach,
  type SlaPassState,
} from "@/lib/notifications/slaBreach";
import { useNotificationPreferences } from "@/store/notificationPreferences";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export interface UseSlaBreachAlertOptions {
  /**
   * Explicit initial pass state. Useful for test environments or simulating transitions.
   * If omitted, the initial mount state is captured without triggering false alarms.
   */
  initialState?: SlaPassState;
  /** Optional custom date/time for quiet-hours evaluation */
  now?: Date;
}

export function useSlaBreachAlert(
  slaPanelData: SlaPanelData | undefined,
  options?: UseSlaBreachAlertOptions,
) {
  const prefs = useNotificationPreferences();
  const { t } = useTranslation();
  const prevStateRef = useRef<SlaPassState | null>(options?.initialState ?? null);

  useEffect(() => {
    if (!slaPanelData || slaPanelData.filledCount === 0) return;

    if (!prevStateRef.current) {
      // First observation: record baseline state without emitting notifications
      prevStateRef.current = { ...slaPanelData.sla };
      return;
    }

    const { transitions, nextState } = detectSlaBreachTransitions(
      prevStateRef.current,
      slaPanelData.sla,
      slaPanelData.percentiles,
    );

    prevStateRef.current = nextState;

    for (const event of transitions) {
      notifySlaBreach(event, prefs, t, options?.now);
    }
  }, [slaPanelData, prefs, t, options?.now]);
}
