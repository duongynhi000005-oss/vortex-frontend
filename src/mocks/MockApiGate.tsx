"use client";

import { useEffect, useState, type ReactNode } from "react";
import { resolveScenario } from "./scenarios";

/**
 * Holds the app back until the mock service worker is ready, so the first
 * SWR fetches are answered by the mocks rather than the (absent) relay.
 * Inert unless `NEXT_PUBLIC_MOCK_API=1` and the build is not production.
 */
export function MockApiGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(
    !(process.env.NEXT_PUBLIC_MOCK_API === "1" && process.env.NODE_ENV !== "production"),
  );

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    import("./browser")
      .then(({ startMockApi }) => startMockApi(resolveScenario(window.location.search)))
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready ? <>{children}</> : null;
}
