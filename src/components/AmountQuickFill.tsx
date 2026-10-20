"use client";

import { parseAmountToStroops, quickFillAmount, ZERO } from "@/lib/decimal";

const FRACTIONS = [25, 50, 75, 100] as const;
/** 10 operations at the 100-stroop base fee, kept back from "Max". */
const DEFAULT_FEE_RESERVE = "0.0001";

export interface AmountQuickFillProps {
  /** Live balance from useTrustline; null while unknown. */
  balance: string | null;
  /** Amount kept back from "Max" for network fees. */
  feeReserve?: string;
  onSelect: (amount: string) => void;
}

export function AmountQuickFill({ balance, feeReserve = DEFAULT_FEE_RESERVE, onSelect }: AmountQuickFillProps) {
  const stroops = balance === null ? null : parseAmountToStroops(balance);
  const disabled = stroops === null || stroops === ZERO;

  const fill = (percent: number) => {
    if (balance === null) return;
    const amount = quickFillAmount(balance, percent, feeReserve);
    if (amount !== null) onSelect(amount);
  };

  return (
    <div role="group" aria-label="Quick amount" className="quick-fill">
      {FRACTIONS.map((percent) => (
        <button key={percent} type="button" className="quick-fill-btn" disabled={disabled} onClick={() => fill(percent)}>
          {percent === 100 ? "Max" : `${percent}%`}
        </button>
      ))}
    </div>
  );
}
