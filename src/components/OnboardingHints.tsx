"use client";

import { useCallback, useEffect, useState } from "react";
import { useWalletStore } from "@/store/wallet";
import {
  FIRST_INTENT_EVENT,
  hasSubmittedFirstIntent,
  LAST_INTENT_EVENT,
  loadLastSubmittedIntent,
} from "@/lib/intentLifecycle";

/**
 * First-swap onboarding checklist.
 *
 * Every item is driven by a real, already-available signal — never simulated
 * progress:
 *   - connect wallet  → useWalletStore connection state
 *   - pick a token    → TokenSelector favorites/recents in localStorage
 *   - open settings   → SwapSettings "opened once" flag in localStorage
 *   - submit a swap   → intentLifecycle first-intent milestone
 *
 * Dismissal and completion are persisted locally so the panel never reappears
 * once finished or explicitly dismissed.
 */

export const ONBOARDING_DISMISSED_KEY = "vortex:onboardingDismissed";
export const ONBOARDING_SETTINGS_OPENED_KEY = "vortex:onboardingSettingsOpened";
export const TOKEN_FAVORITES_KEY = "vortex:tokenFavorites";
export const TOKEN_RECENTS_KEY = "vortex:tokenRecents";

export interface OnboardingMilestones {
  walletConnected: boolean;
  tokenPicked: boolean;
  settingsOpened: boolean;
  firstSwapSubmitted: boolean;
}

export interface OnboardingItem {
  id: keyof OnboardingMilestones;
  label: string;
  done: boolean;
}

const readFlag = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const hasStoredTokens = (key: string): boolean => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
};

/** Pure derivation of checklist items from real milestone signals. */
export function buildOnboardingItems(milestones: OnboardingMilestones): OnboardingItem[] {
  return [
    { id: "walletConnected", label: "Connect your wallet", done: milestones.walletConnected },
    { id: "tokenPicked", label: "Pick a token", done: milestones.tokenPicked },
    { id: "settingsOpened", label: "Open swap settings", done: milestones.settingsOpened },
    { id: "firstSwapSubmitted", label: "Submit your first swap", done: milestones.firstSwapSubmitted },
  ];
}

export function isOnboardingComplete(items: OnboardingItem[]): boolean {
  return items.length > 0 && items.every((item) => item.done);
}

function readMilestones(walletConnected: boolean): OnboardingMilestones {
  return {
    walletConnected,
    tokenPicked: hasStoredTokens(TOKEN_FAVORITES_KEY) || hasStoredTokens(TOKEN_RECENTS_KEY),
    settingsOpened: readFlag(ONBOARDING_SETTINGS_OPENED_KEY),
    firstSwapSubmitted: hasSubmittedFirstIntent() || loadLastSubmittedIntent() !== null,
  };
}

export default function OnboardingHints() {
  const walletConnected = useWalletStore((s) => s.isConnected);
  const [dismissed, setDismissed] = useState(true);
  const [milestones, setMilestones] = useState<OnboardingMilestones>(() => ({
    walletConnected: false,
    tokenPicked: false,
    settingsOpened: false,
    firstSwapSubmitted: false,
  }));

  const refresh = useCallback(() => {
    setMilestones(readMilestones(walletConnected));
  }, [walletConnected]);

  useEffect(() => {
    setDismissed(readFlag(ONBOARDING_DISMISSED_KEY));
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    window.addEventListener(FIRST_INTENT_EVENT, onChange);
    window.addEventListener(LAST_INTENT_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(FIRST_INTENT_EVENT, onChange);
      window.removeEventListener(LAST_INTENT_EVENT, onChange);
    };
  }, [refresh]);

  const items = buildOnboardingItems(milestones);
  const complete = isOnboardingComplete(items);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    } catch {
      // Storage may be unavailable; hide for this session only.
    }
    setDismissed(true);
  }, []);

  if (dismissed || complete) return null;

  return (
    <section
      aria-label="Getting started"
      className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Getting started</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started checklist"
          className="rounded px-2 py-1 text-xs text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Dismiss
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
              {item.done ? "✓" : "○"}
            </span>
            <span className={item.done ? "text-white/60 line-through" : "text-white"}>
              {item.label}
            </span>
            <span className="sr-only">{item.done ? "completed" : "not completed"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
