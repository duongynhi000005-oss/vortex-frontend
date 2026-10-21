"use client";

import { useState } from "react";
import type { Contributor, ContributorsSource } from "@/lib/contributors";

const SOURCE_COPY: Record<Exclude<ContributorsSource, "live">, string> = {
  cache: "Showing the last successfully fetched contributor data because GitHub is temporarily unreachable.",
  fallback: "Showing a bundled contributor snapshot because live GitHub data is unavailable.",
};

export function ContributorsList({ contributors, source }: { contributors: Contributor[]; source: ContributorsSource }) {
  const [noticeVisible, setNoticeVisible] = useState(source !== "live");
  return (
    <div className="space-y-4">
      {source !== "live" && noticeVisible && (
        <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-vx-border bg-vx-surface p-4 text-sm text-vx-muted">
          <p>{SOURCE_COPY[source]}</p>
          <button type="button" aria-label="Dismiss contributor data notice" onClick={() => setNoticeVisible(false)} className="text-vx-text hover:text-vx-sage">Dismiss</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {contributors.map((contributor) => (
          <a key={contributor.login} href={contributor.profileUrl} target="_blank" rel="noopener noreferrer" className="card flex flex-col items-center gap-3 p-5 text-center">
            <img src={contributor.avatarUrl} alt="" width={80} height={80} className="h-20 w-20 rounded-full" />
            <span className="text-sm font-semibold text-vx-text">{contributor.login}</span>
            <span className="text-xs text-vx-muted">{contributor.contributions} contributions</span>
          </a>
        ))}
      </div>
    </div>
  );
}
