import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_DEADLINE_MIN, DEFAULT_SLIPPAGE_PCT } from "@/lib/slippage";

type SwapSettingsState = {
  slippagePct: number;
  deadlineMin: number;
  // Not persisted: true once the user picks slippage during this page session.
  slippageOverridden: boolean;
  setSlippagePct: (pct: number) => void;
  setDeadlineMin: (minutes: number) => void;
  resetToDefaults: () => void;
};

const DEFAULTS = { slippagePct: DEFAULT_SLIPPAGE_PCT, deadlineMin: DEFAULT_DEADLINE_MIN, slippageOverridden: false };

// Persisted per browser. Bump `version` (and add a `migrate`) if the shape changes.
export const useSwapSettingsStore = create<SwapSettingsState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setSlippagePct: slippagePct => set({ slippagePct, slippageOverridden: true }),
      setDeadlineMin: deadlineMin => set({ deadlineMin }),
      resetToDefaults: () => set(DEFAULTS),
    }),
    {
      name: "vortex-swap-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ slippagePct, deadlineMin }) => ({ slippagePct, deadlineMin }),
    },
  ),
);
