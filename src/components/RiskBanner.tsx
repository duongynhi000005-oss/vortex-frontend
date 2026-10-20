"use client";
import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import type { QuoteRisk } from "@/lib/quoteRisk";

const PRICE_IMPACT_DOCS_URL =
  "https://github.com/stellar-vortex-protocol/vortex-frontend/blob/main/docs/transaction-flow.md#price-impact";

export function RiskBanner({ risk, onConfirmed }: { risk: QuoteRisk; onConfirmed?: (confirmed: boolean) => void }) {
  const [phrase, setPhrase] = useState("");
  if (risk.level === "none") return null;
  const severe = risk.requiresConfirmation;
  return (
    <div role="alert" className="rounded border border-amber-400/50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>
          {risk.level === "caution" ? "Caution" : risk.level === "warning" ? "High price impact" : "Severe price impact"}
        </strong>
        <Tooltip content="Price impact is how much your trade moves the price against you, because the pool's price shifts as you trade. Larger trades relative to available liquidity cause more impact.">
          <button
            type="button"
            className="text-xs underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
          >
            What does this mean?
          </button>
        </Tooltip>
        <a
          href={PRICE_IMPACT_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          Learn more
        </a>
      </div>
      <ul>
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {severe && (
        <label className="mt-2 block">
          Type CONFIRM to continue
          <input
            aria-label="Risk confirmation"
            value={phrase}
            onChange={(event) => {
              setPhrase(event.target.value);
              onConfirmed?.(event.target.value === "CONFIRM");
            }}
            className="ml-2 rounded border"
          />
        </label>
      )}
    </div>
  );
}
