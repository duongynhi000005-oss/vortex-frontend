"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { SkeletonBlock } from "@/components/Skeleton";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { Contributor, ContributorsResponse, ContributorsSource } from "@/lib/contributors";

const fetcher = async (url: string): Promise<ContributorsResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load contributors");
  return res.json();
};

export function GitHubContributorsWall() {
  const { t } = useTranslation();
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
  const [dismissNotice, setDismissNotice] = useState(false);

  const { data, error, isLoading } = useSWR<ContributorsResponse>(
    "/api/contributors",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const sortedContributors = useMemo(() => {
    if (!data?.contributors) return [];
    return [...data.contributors].sort((a, b) => a.login.localeCompare(b.login));
  }, [data?.contributors]);

  const source: ContributorsSource | undefined = data?.source;

  return (
    <section aria-label={t("contributors.title")} className="space-y-4 mb-10">
      {source && source !== "live" && !dismissNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-xl border border-vx-border bg-vx-surface p-4 text-xs sm:text-sm text-vx-muted"
        >
          <p>
            {t(
              source === "cache"
                ? "contributors.notice.cache"
                : "contributors.notice.fallback"
            )}
          </p>
          <button
            type="button"
            aria-label={t("contributors.notice.dismiss")}
            onClick={() => setDismissNotice(true)}
            className="text-vx-text hover:text-vx-sage font-medium transition-colors"
          >
            {t("contributors.notice.dismiss")}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 flex flex-col items-center gap-3 animate-pulse">
              <SkeletonBlock className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
              <SkeletonBlock className="h-4 w-20 rounded" />
              <SkeletonBlock className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-vx-text">{t("contributors.error.title")}</h2>
          <p className="text-sm text-vx-muted">{t("contributors.error.message")}</p>
        </div>
      ) : sortedContributors.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-vx-text">{t("contributors.empty.title")}</h2>
          <p className="text-sm text-vx-muted">{t("contributors.empty.message")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-vx-muted mb-4">
            <span>
              {t(
                sortedContributors.length === 1
                  ? "contributors.count.one"
                  : "contributors.count.other",
                { count: sortedContributors.length }
              )}
            </span>
            {source && (
              <span
                data-testid="contributors-source-badge"
                className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                  source === "live"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : source === "cache"
                    ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/20"
                    : "bg-amber-500/10 text-vx-amber border border-amber-500/20"
                }`}
              >
                {t(
                  source === "live"
                    ? "contributors.source.live"
                    : source === "cache"
                    ? "contributors.source.cache"
                    : "contributors.source.fallback"
                )}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sortedContributors.map((c: Contributor) => {
              const isBroken = brokenAvatars.has(c.login);
              return (
                <a
                  key={c.login}
                  href={c.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card p-4 sm:p-5 flex flex-col items-center gap-2.5 hover:border-vx-sage/40 transition-colors group text-center"
                >
                  {!isBroken ? (
                    <Image
                      src={c.avatarUrl}
                      alt={t("contributors.avatarAlt", { login: c.login })}
                      width={80}
                      height={80}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-vx-border group-hover:border-vx-sage/40 transition-colors object-cover"
                      onError={() =>
                        setBrokenAvatars((prev) => {
                          const next = new Set(prev);
                          next.add(c.login);
                          return next;
                        })
                      }
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={t("contributors.avatarAlt", { login: c.login })}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-vx-surface border-2 border-vx-border group-hover:border-vx-sage/40 flex items-center justify-center font-bold text-base text-vx-sage uppercase"
                    >
                      {c.login.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    <div className="text-xs sm:text-sm font-semibold text-vx-text group-hover:text-vx-sage transition-colors truncate">
                      @{c.login}
                    </div>
                    <div className="text-[11px] text-vx-muted mt-0.5">
                      {t(
                        c.contributions === 1
                          ? "contributors.contributions.one"
                          : "contributors.contributions.other",
                        { count: c.contributions }
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
