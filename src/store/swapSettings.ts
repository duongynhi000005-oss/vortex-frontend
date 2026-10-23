import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_DEADLINE_MIN, DEFAULT_SLIPPAGE_PCT } from "@/lib/slippage";

type SwapPrefs = {
  slippagePct: number;
  deadlineMin: number;
};

type PersistedSwapSettings = {
  // Per source-chain overrides, keyed by chain id.
  byChain: Partial<Record<string, SwapPrefs>>;
  // Used for any chain without an override. Seeded from the pre-per-chain value by `migrate`.
  default: SwapPrefs;
};

type SwapSettingsState = PersistedSwapSettings &
  SwapPrefs & {
    // Not persisted: true once the user picks slippage during this page session.
    slippageOverridden: boolean;
    setSlippagePct: ((srcChain: string, pct: number) => void) & ((pct: number) => void);
    setDeadlineMin: ((srcChain: string, minutes: number) => void) & ((minutes: number) => void);
    // With a chain, clears only that chain's override; without one, clears everything.
    resetToDefaults: (srcChain?: string) => void;
  };

const DEFAULTS: SwapPrefs = { slippagePct: DEFAULT_SLIPPAGE_PCT, deadlineMin: DEFAULT_DEADLINE_MIN };

const prefsFor = (state: PersistedSwapSettings, srcChain: string): SwapPrefs => ({
  ...state.default,
  ...state.byChain[srcChain],
});

// Persisted per browser. Bump `version` (and extend `migrate`) if the shape changes.
export const useSwapSettingsStore = create<SwapSettingsState>()(
  persist(
    set => ({
      byChain: {},
      default: DEFAULTS,
      ...DEFAULTS,
      slippageOverridden: false,
      setSlippagePct: ((arg1: string | number, arg2?: number) => {
        if (typeof arg1 === "number") {
          const slippagePct = arg1;
          set(state => ({
            slippagePct,
            slippageOverridden: true,
            default: { ...state.default, slippagePct },
          }));
          return;
        }
        const srcChain = arg1;
        const slippagePct = arg2 ?? DEFAULT_SLIPPAGE_PCT;
        set(state => ({
          slippagePct,
          slippageOverridden: true,
          byChain: { ...state.byChain, [srcChain]: { ...prefsFor(state, srcChain), slippagePct } },
        }));
      }) as SwapSettingsState["setSlippagePct"],
      setDeadlineMin: ((arg1: string | number, arg2?: number) => {
        if (typeof arg1 === "number") {
          const deadlineMin = arg1;
          set(state => ({
            deadlineMin,
            default: { ...state.default, deadlineMin },
          }));
          return;
        }
        const srcChain = arg1;
        const deadlineMin = arg2 ?? DEFAULT_DEADLINE_MIN;
        set(state => ({
          deadlineMin,
          byChain: { ...state.byChain, [srcChain]: { ...prefsFor(state, srcChain), deadlineMin } },
        }));
      }) as SwapSettingsState["setDeadlineMin"],
      resetToDefaults: srcChain =>
        set(state => {
          if (srcChain === undefined) {
            return { byChain: {}, default: DEFAULTS, ...DEFAULTS, slippageOverridden: false };
          }
          const byChain = { ...state.byChain };
          delete byChain[srcChain];
          return { byChain, ...state.default, slippageOverridden: false };
        }),
    }),
    {
      name: "vortex-swap-settings",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ byChain, default: fallback }) => ({ byChain, default: fallback }),
      migrate: (persisted, version) => {
        if (version < 2) {
          // v1 stored a single flat { slippagePct, deadlineMin } for every chain. Keep it as the
          // fallback so an existing customisation still applies to chains without their own value.
          const legacy = persisted as Partial<SwapPrefs> | undefined;
          return { byChain: {}, default: { ...DEFAULTS, ...legacy } };
        }
        return persisted as PersistedSwapSettings;
      },
    },
  ),
);

/**
 * Slippage and deadline for one source chain, falling back to the default when that chain
 * has no saved preference. Keeps the same shape the single-value hook had.
 */
export function useSwapSettings(srcChain = "default") {
  const slippagePct = useSwapSettingsStore(state => prefsFor(state, srcChain).slippagePct);
  const deadlineMin = useSwapSettingsStore(state => prefsFor(state, srcChain).deadlineMin);
  const slippageOverridden = useSwapSettingsStore(state => state.slippageOverridden);
  const setSlippage = useSwapSettingsStore(state => state.setSlippagePct);
  const setDeadline = useSwapSettingsStore(state => state.setDeadlineMin);
  const reset = useSwapSettingsStore(state => state.resetToDefaults);

  return {
    slippagePct,
    deadlineMin,
    slippageOverridden,
    setSlippagePct: (pct: number) => setSlippage(srcChain, pct),
    setDeadlineMin: (minutes: number) => setDeadline(srcChain, minutes),
    resetToDefaults: () => reset(srcChain),
  };
}
