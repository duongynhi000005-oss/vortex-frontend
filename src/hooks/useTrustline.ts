"use client";

import { useCallback, useEffect, useState } from "react";
import type { Token } from "@/lib/types";
import { getTrustlineSnapshot, type TrustlineState } from "@/lib/chain/horizon";

export function useTrustline(address: string | null, asset: Token | null) {
  const [state, setState] = useState<TrustlineState>("unknown");
  const [balance, setBalance] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    if (!address || !asset) { setState("exists"); setBalance(null); return; }
    setChecking(true);
    const snapshot = await getTrustlineSnapshot(address, asset);
    setState(snapshot.state); setBalance(snapshot.balance); setChecking(false);
  }, [address, asset]);
  useEffect(() => { void check(); }, [check]);
  // Keep polling while the trustline is missing (waiting for it) or present (tracking the live balance).
  useEffect(() => { if (state === "unknown") return; const timer = window.setInterval(check, 4_000); return () => window.clearInterval(timer); }, [check, state]);
  return { state, balance, checking, refresh: check };
}
