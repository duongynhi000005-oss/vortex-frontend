import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  detectSlaBreachTransitions,
  buildSlaBreachBody,
  buildSlaBreachTitle,
  buildSlaBreachNotificationIntent,
  notifySlaBreach,
  DEFAULT_SLA_PASS_STATE,
  type SlaPassState,
  type SlaBreachEvent,
} from "./slaBreach";
import { SLA_THRESHOLDS, type FillTimePercentiles, type SlaPanelData } from "@/lib/analytics";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/store/notificationPreferences";
import { useToastStore } from "@/store/toast";
import { renderHook } from "@testing-library/react";
import { useSlaBreachAlert } from "@/hooks/useSlaBreachAlert";

describe("SLA Breach Alert System (#605)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
  });

  describe("detectSlaBreachTransitions", () => {
    const defaultPercentiles: FillTimePercentiles = {
      p50: 20,
      p90: 50,
      p99: 100,
    };

    it("emits no events when all percentiles continue passing", () => {
      const prev: SlaPassState = { p50: true, p90: true, p99: true };
      const current: SlaPassState = { p50: true, p90: true, p99: true };

      const { transitions, nextState } = detectSlaBreachTransitions(
        prev,
        current,
        defaultPercentiles,
      );

      expect(transitions).toHaveLength(0);
      expect(nextState).toEqual({ p50: true, p90: true, p99: true });
    });

    it("emits exactly one event when a single percentile transitions from pass to fail", () => {
      const prev: SlaPassState = { p50: true, p90: true, p99: true };
      const current: SlaPassState = { p50: false, p90: true, p99: true };
      const percentiles: FillTimePercentiles = { p50: 35.4, p90: 50, p99: 100 };

      const { transitions, nextState } = detectSlaBreachTransitions(
        prev,
        current,
        percentiles,
      );

      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        percentile: "p50",
        value: 35.4,
        threshold: SLA_THRESHOLDS.p50MaxSeconds, // 30
      });
      expect(nextState).toEqual({ p50: false, p90: true, p99: true });
    });

    it("suppresses notifications on sustained failure (false -> false)", () => {
      // Previously already failing
      const prev: SlaPassState = { p50: false, p90: true, p99: true };
      // Still failing on next render/poll cycle
      const current: SlaPassState = { p50: false, p90: true, p99: true };
      const percentiles: FillTimePercentiles = { p50: 38.2, p90: 52, p99: 105 };

      const { transitions, nextState } = detectSlaBreachTransitions(
        prev,
        current,
        percentiles,
      );

      expect(transitions).toHaveLength(0);
      expect(nextState).toEqual({ p50: false, p90: true, p99: true });
    });

    it("resets latch on recovery (false -> true) and re-triggers on subsequent breach", () => {
      // 1. Recover back to pass
      const failingPrev: SlaPassState = { p50: false, p90: true, p99: true };
      const recoveredCurrent: SlaPassState = { p50: true, p90: true, p99: true };
      const recoveredPercentiles: FillTimePercentiles = { p50: 22, p90: 45, p99: 90 };

      const recovery = detectSlaBreachTransitions(
        failingPrev,
        recoveredCurrent,
        recoveredPercentiles,
      );

      expect(recovery.transitions).toHaveLength(0);
      expect(recovery.nextState.p50).toBe(true);

      // 2. Subsequent breach triggers anew
      const breachedAgain: SlaPassState = { p50: false, p90: true, p99: true };
      const breachedPercentiles: FillTimePercentiles = { p50: 42, p90: 45, p99: 90 };

      const reTrigger = detectSlaBreachTransitions(
        recovery.nextState,
        breachedAgain,
        breachedPercentiles,
      );

      expect(reTrigger.transitions).toHaveLength(1);
      expect(reTrigger.transitions[0]!.percentile).toBe("p50");
      expect(reTrigger.transitions[0]!.value).toBe(42);
      expect(reTrigger.nextState.p50).toBe(false);
    });

    it("detects multiple percentile breaches occurring simultaneously", () => {
      const prev: SlaPassState = { p50: true, p90: true, p99: true };
      const current: SlaPassState = { p50: false, p90: false, p99: false };
      const percentiles: FillTimePercentiles = { p50: 35, p90: 75, p99: 150 };

      const { transitions, nextState } = detectSlaBreachTransitions(
        prev,
        current,
        percentiles,
      );

      expect(transitions).toHaveLength(3);
      expect(transitions.map((t) => t.percentile)).toEqual(["p50", "p90", "p99"]);
      expect(nextState).toEqual({ p50: false, p90: false, p99: false });
    });
  });

  describe("buildSlaBreachNotificationIntent & formatters", () => {
    const event: SlaBreachEvent = {
      percentile: "p90",
      value: 65.5,
      threshold: 60,
    };

    it("formats title and body with fallback strings", () => {
      const title = buildSlaBreachTitle();
      expect(title).toBe("SLA Threshold Breached");

      const body = buildSlaBreachBody(event);
      expect(body).toBe("P90 fill time exceeded SLA (65.5s > 60s)");
    });

    it("uses translator when available", () => {
      const mockT = vi.fn((key: string, vars?: any) => {
        if (key === "notifications.slaBreach.title") return "Translated Title";
        if (key === "notifications.slaBreach.p90") {
          return `Translated P90: ${vars.value} > ${vars.threshold}`;
        }
        return key;
      });

      const intent = buildSlaBreachNotificationIntent(event, mockT as any);
      expect(intent.title).toBe("Translated Title");
      expect(intent.body).toBe("Translated P90: 65.5 > 60");
      expect(intent.href).toBe("/analytics");
      expect(intent.status).toBe("failed");
    });
  });

  describe("notifySlaBreach & channel preferences", () => {
    const event: SlaBreachEvent = {
      percentile: "p50",
      value: 32.5,
      threshold: 30,
    };

    it("adds a toast to useToastStore when toast channel is enabled", () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          toast: true,
          browser: false,
        },
      };

      const decision = notifySlaBreach(event, prefs);

      expect(decision.toast).toBe(true);
      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.variant).toBe("error");
      expect(toasts[0]!.message).toContain("P50 fill time exceeded SLA");
      expect(toasts[0]!.href).toBe("/analytics");
    });

    it("does not add a toast when toast channel is disabled", () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          toast: false,
          browser: false,
        },
      };

      const decision = notifySlaBreach(event, prefs);

      expect(decision.toast).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("suppresses notifications during quiet hours", () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        quietStart: "22:00",
        quietEnd: "07:00",
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          toast: true,
        },
      };

      // 23:30 is inside quiet hours
      const nightTime = new Date("2026-10-24T23:30:00");
      const decision = notifySlaBreach(event, prefs, undefined, nightTime);

      expect(decision.toast).toBe(false);
      expect(decision.browser).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("suppresses notifications when 'failed' status is disabled in preferences", () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        statuses: {
          accepted: true,
          filled: true,
          failed: false, // User disabled failure alerts
        },
      };

      const decision = notifySlaBreach(event, prefs);

      expect(decision.toast).toBe(false);
      expect(decision.browser).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("triggers browser notification when browser channel is enabled and permission is granted", () => {
      const notificationSpy = vi.fn();
      vi.stubGlobal("Notification", Object.assign(notificationSpy, { permission: "granted" }));

      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          browser: true,
          toast: false,
        },
      };

      const decision = notifySlaBreach(event, prefs);

      expect(decision.browser).toBe(true);
      expect(notificationSpy).toHaveBeenCalledWith(
        "SLA Threshold Breached",
        expect.objectContaining({
          body: expect.stringContaining("P50 fill time exceeded SLA"),
        }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe("useSlaBreachAlert React hook", () => {
    const makeData = (p50Pass: boolean): SlaPanelData => ({
      percentiles: { p50: p50Pass ? 20 : 35, p90: 50, p99: 100 },
      histogram: [],
      successRateByDay: [],
      successRateMovingAvg: [],
      filledCount: 10,
      pendingCount: 0,
      clampedCount: 0,
      sla: {
        p50: p50Pass,
        p90: true,
        p99: true,
      },
    });

    it("records initial state without firing on initial mount", () => {
      // First mount with failing data
      const data = makeData(false);
      renderHook(() => useSlaBreachAlert(data));

      // Should not alarm upon initial hydration
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("emits notification on pass -> fail re-render transition", () => {
      let currentData = makeData(true);
      const { rerender } = renderHook(() => useSlaBreachAlert(currentData));

      expect(useToastStore.getState().toasts).toHaveLength(0);

      // Re-render with breach
      currentData = makeData(false);
      rerender();

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0]!.message).toMatch(/p50 fill time exceeded sla/i);

      // Re-render with sustained breach: no duplicate
      rerender();
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });
});
