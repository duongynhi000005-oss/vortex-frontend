"use client";

import { useEffect, useMemo, useState } from "react";
import { AddressRiskWarning } from "./AddressDiff";
import { assessAddress } from "@/lib/addressRisk";
import { getKnownAddresses } from "@/lib/knownAddresses";
import { isSameStellarAddress, isValidStellarAddress, normalizeStellarAddress } from "@/lib/stellarAddress";

export type RecipientFieldProps = {
  value: string;
  onChange: (value: string) => void;
  connectedAddress: string;
  knownAddresses?: readonly string[];
  onValidityChange?: (valid: boolean) => void;
};

/** Optional custom swap recipient with checksum and lookalike protection. */
export function RecipientField({
  value,
  onChange,
  connectedAddress,
  knownAddresses,
  onValidityChange,
}: RecipientFieldProps) {
  const [expanded, setExpanded] = useState(Boolean(value));
  const [riskAccepted, setRiskAccepted] = useState(false);
  const normalized = normalizeStellarAddress(value);
  const addresses = knownAddresses ?? getKnownAddresses();
  const assessment = useMemo(() => assessAddress(normalized, addresses), [normalized, addresses]);
  const formatValid = normalized.length === 0 || isValidStellarAddress(normalized);
  const different = normalized.length === 0 || !isSameStellarAddress(normalized, connectedAddress);
  const safe = assessment.risk !== "high" || riskAccepted;
  const valid = !expanded || (normalized.length > 0 && formatValid && different && safe);

  useEffect(() => onValidityChange?.(valid), [onValidityChange, valid]);

  function setRecipient(next: string) {
    setRiskAccepted(false);
    onChange(normalizeStellarAddress(next));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (!next) onChange("");
        }}
        className="text-sm font-semibold text-vx-sage underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
      >
        {expanded ? "Send to connected wallet" : "Send to a different address"}
      </button>

      {expanded && (
        <div className="space-y-2">
          <label className="block space-y-2 text-sm text-vx-text">
            <span>Recipient Stellar address</span>
            <input
              value={value}
              onChange={(event) => setRecipient(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!valid}
              className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2 font-mono text-xs uppercase text-vx-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
              placeholder="G…"
            />
          </label>
          {!formatValid && <p role="alert" className="text-xs text-vx-amber">Enter a checksum-valid Stellar account address.</p>}
          {formatValid && !different && <p role="alert" className="text-xs text-vx-amber">Use the connected wallet directly or enter a different recipient.</p>}
          <AddressRiskWarning candidate={normalized} assessment={assessment} onDismiss={() => setRiskAccepted(true)} />
        </div>
      )}
    </div>
  );
}
