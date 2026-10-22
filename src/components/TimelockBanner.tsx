"use client";

import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";

function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Read-only timelock countdown for a queued proposal. */
export function TimelockBanner({ timelockEndsAt }: { timelockEndsAt?: string }) {
  const now = useLiveRelativeTime(15_000);
  const endsAt = timelockEndsAt ? Date.parse(timelockEndsAt) : NaN;

  let message: string;
  if (Number.isNaN(endsAt)) {
    message = "Queued in timelock. The execution time is not available yet.";
  } else if (endsAt <= now) {
    message = "Timelock ended. This proposal is ready to execute.";
  } else {
    message = `In timelock. Executable in ${formatRemaining(endsAt - now)} (${new Date(endsAt).toUTCString()}).`;
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-400"
    >
      {message}
    </div>
  );
}
