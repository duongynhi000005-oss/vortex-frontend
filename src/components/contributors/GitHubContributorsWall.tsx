"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import type { Contributor, ContributorsResponse, ContributorsSource } from "@/lib/contributors";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

const SOURCE_KEY: Record<ContributorsSource, MessageKey> = {
  live: "wave.githubContributors.source.live",
  cache: "wave.githubContributors.source.cache",
  fallback: "wave.githubContributors.source.fallback",
};

const SOURCE_CLASS: Record<ContributorsSource, string> = {
  live: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cache: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fallback: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const fetcher = async (url: string): Promise<ContributorsResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function ContributorCard({ contributor }: { contributor: Contributor }) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={contributor.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("wave.githubContributors.profileAria", { login: contributor.login })}
      className="card p-3 sm:p-4 flex items-center gap-3 hover:bg-vx-surface/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded-xl group"
    >
      <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-vx-surface border border-vx-border/60">
        {!imgError ? (
          <Image
            src={contributor.avatarUrl}
            alt={contributor.login}
            fill
            sizes="40px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            data-testid={`avatar-fallback-${contributor.login}`}
            className="w-full h-full flex items-center justify-center bg-vx-surface text-vx-sage font-bold text-xs font-mono"
            aria-hidden="true"
          >
            {contributor.login.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs sm:text-sm font-semibold text-vx-text truncate group-hover:text-vx-sage transition-colors">
          @{contributor.login}
        </div>
        <div className="text-[11px] text-vx-muted font-mono">
          {t("wave.githubContributors.contributions", { count: contributor.contributions })}
        </div>
      </div>
    </a>
  );
}

export function GitHubContributorsWall({
  className = "",
  initialData,
}: {
  className?: string;
  initialData?: ContributorsResponse;
}) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<ContributorsResponse>(
    "/api/contributors",
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  const contributors = data?.contributors ?? [];
  const source = data?.source ?? "cache";

  return (
    <section className={`card overflow-hidden ${className}`} aria-labelledby="github-contributors-title">
      <div className="px-5 py-4 border-b border-vx-border bg-vx-surface/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="github-contributors-title" className="text-base font-semibold text-vx-text">
              {t("wave.githubContributors.title")}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-vx-surface text-vx-sage border border-vx-sage/20">
              {t("wave.githubContributors.count", { count: contributors.length })}
            </span>
            {data && (
              <span
                data-testid="contributors-source-badge"
                className={`text-[10px] font-medium px-2 py-0.5 rounded border ${SOURCE_CLASS[source]}`}
              >
                {t(SOURCE_KEY[source])}
              </span>
            )}
          </div>
          <p className="text-xs text-vx-muted mt-1">
            {t("wave.githubContributors.description")}
          </p>
        </div>
      </div>

      <div className="p-5">
        {isLoading && !data && (
          <div className="py-8 text-center text-xs text-vx-muted" role="status">
            {t("wave.githubContributors.loading")}
          </div>
        )}

        {error && !data && (
          <div className="py-8 text-center text-xs text-red-400" role="alert">
            {t("wave.githubContributors.error")}
          </div>
        )}

        {data && contributors.length === 0 && (
          <div className="py-8 text-center text-xs text-vx-muted">
            {t("wave.githubContributors.empty")}
          </div>
        )}

        {contributors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {contributors.map((contributor) => (
              <ContributorCard key={contributor.login} contributor={contributor} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default GitHubContributorsWall;
