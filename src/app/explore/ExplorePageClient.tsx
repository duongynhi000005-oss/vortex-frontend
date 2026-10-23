"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Footer } from "@/components/Footer";
import { IntentComparePanel, MAX_COMPARE_INTENTS } from "@/components/IntentComparePanel";
import { Nav } from "@/components/Nav";
import { SkeletonCard } from "@/components/Skeleton";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { buildIntentsCsv, downloadCsv } from "@/lib/csv";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { SortSpec } from "@/lib/solverRanking";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

const PAGE_SIZE = 10;
const BACK_TO_TOP_OFFSET = 400;

type SortKey = "time" | "amount";

/**
 * Visible label of the Time column. DataTable only mounts the rows it renders
 * (virtualised rows unmount when scrolled away), so each live cell runs its own
 * interval only while on screen; the absolute time stays in `title`.
 */
export function RelativeTimeCell({ iso }: { iso: string }) {
  const now = useLiveRelativeTime();
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className="text-xs text-vx-muted num">
      {timeAgo(iso, now)}
    </time>
  );
}

const COLUMNS: readonly DataTableColumn<FeedItem, SortKey | "swap" | "chain" | "solver" | "status">[] = [
  {
    id: "swap",
    header: "Swap",
    isRowHeader: true,
    cell: (i) => (
      <Link href={`/explore/${encodeURIComponent(i.id)}`} className="text-vx-text hover:underline">
        {sanitizeDisplayText(`${i.srcAmount} ${i.srcToken} → ${i.dstToken}`)}
      </Link>
    ),
  },
  { id: "amount", header: "Amount", sortable: true, align: "right", cell: (i) => <span className="num">{i.srcAmount}</span> },
  { id: "chain", header: "Chain", cell: (i) => sanitizeDisplayText(i.srcChain) },
  { id: "solver", header: "Solver", cell: (i) => sanitizeDisplayText(i.solver ?? "—") },
  { id: "status", header: "Status", cell: (i) => i.status },
  { id: "time", header: "Time", sortable: true, align: "right", cell: (i) => <RelativeTimeCell iso={i.createdAt} /> },
];

function initialSorts(raw: string | null): SortSpec<SortKey>[] {
  return [{ key: "time", dir: raw === "oldest" ? "asc" : "desc" }];
}

export default function ExplorePageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error, isLive } = useLiveIntents();
  const [status, setStatus] = useState("");
  const [chain, setChain] = useState("");
  const [sorts, setSorts] = useState<SortSpec<SortKey>[]>(() =>
    initialSorts(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("sort")),
  );
  const [page, setPage] = useState(1);
  const [showTop, setShowTop] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const selected = useMemo(
    () => intents.filter((item) => selectedKeys.includes(item.id)),
    [intents, selectedKeys],
  );
  const canCompare = selected.length >= 2;

  // Filters are seeded from the URL after mount and mirrored back on change.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatus(p.get("status") ?? "");
    setChain(p.get("chain") ?? "");
  }, []);

  const syncUrl = (next: { status?: string; chain?: string; sort?: string }) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > BACK_TO_TOP_OFFSET);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(() => {
    const rows = intents.filter((i) => (!status || i.status === status) && (!chain || i.srcChain === chain));
    const spec = sorts[0];
    if (!spec) return rows;
    const dir = spec.dir === "asc" ? 1 : -1;
    const value = (i: FeedItem) => (spec.key === "time" ? Date.parse(i.createdAt) : Number(i.srcAmount));
    return [...rows].sort((a, b) => (value(a) - value(b)) * dir);
  }, [intents, status, chain, sorts]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const statuses = useMemo(() => [...new Set(intents.map((i) => i.status))], [intents]);
  const chains = useMemo(() => [...new Set(intents.map((i) => i.srcChain))], [intents]);

  const setSort = (key: SortKey, dir: "asc" | "desc") => {
    setSorts([{ key, dir }]);
    setPage(1);
    if (key === "time") syncUrl({ sort: dir === "asc" ? "oldest" : "" });
  };

  const handleSort = (key: SortKey) => {
    const existing = sorts.find((s) => s.key === key);
    setSort(key, existing ? (existing.dir === "asc" ? "desc" : "asc") : "desc");
  };

  const selectClass =
    "rounded border border-vx-border bg-vx-card px-2 py-1.5 text-sm text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12 space-y-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-vx-text">Explore intents</h1>
            <p className="text-sm text-vx-muted">
              {filtered.length} {filtered.length === 1 ? "intent" : "intents"} ·{" "}
              <span>{isLive ? "Live" : "Polling"}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by status"
              className={selectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
                syncUrl({ status: e.target.value });
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by chain"
              className={selectClass}
              value={chain}
              onChange={(e) => {
                setChain(e.target.value);
                setPage(1);
                syncUrl({ chain: e.target.value });
              }}
            >
              <option value="">All chains</option>
              {chains.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort order"
              className={selectClass}
              value={sorts[0]?.key === "time" && sorts[0].dir === "asc" ? "oldest" : "newest"}
              onChange={(e) => setSort("time", e.target.value === "oldest" ? "asc" : "desc")}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button
              type="button"
              className="rounded border border-vx-border px-3 py-1.5 text-sm text-vx-text hover:bg-vx-surface/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
              onClick={() => downloadCsv("vortex-intents.csv", buildIntentsCsv(filtered))}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-vx-muted" aria-live="polite">
            {canCompare
              ? t("explore.selectionCount", { count: selected.length, max: MAX_COMPARE_INTENTS })
              : t("explore.selectHint", { max: MAX_COMPARE_INTENTS })}
          </p>
          {canCompare && (
            <button
              type="button"
              onClick={() => setComparing((open) => !open)}
              aria-expanded={comparing}
              className="rounded-lg border border-vx-border px-3 py-1.5 text-xs text-vx-text hover:bg-vx-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {comparing ? t("explore.compare.close") : t("explore.compareSelected", { count: selected.length })}
            </button>
          )}
        </div>

        {canCompare && comparing && <IntentComparePanel intents={selected} />}

        {isLoading ? (
          <SkeletonCard rows={6} rowHeight="h-14" />
        ) : error ? (
          <p role="alert" className="text-sm text-red-400">
            Couldn&apos;t load intents. Please try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-vx-muted">No intents match your filters.</p>
        ) : (
          <>
            <DataTable
              caption="Intents"
              columns={COLUMNS}
              rows={pageRows}
              getRowKey={(i) => i.id}
              sorts={sorts}
              onSort={(key) => (key === "time" || key === "amount") && handleSort(key)}
              selectable
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              selectionLimit={MAX_COMPARE_INTENTS}
              selectionLabels={{
                column: t("explore.table.select"),
                row: (i) => t("explore.table.selectRow", { intent: `${i.srcAmount} ${i.srcToken} → ${i.dstToken}` }),
              }}
            />
            {pageCount > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-4 text-sm">
                <button
                  type="button"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                  className="rounded border border-vx-border px-3 py-1.5 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                >
                  Previous
                </button>
                <span className="text-vx-muted">
                  Page {current} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={current === pageCount}
                  onClick={() => setPage(current + 1)}
                  className="rounded border border-vx-border px-3 py-1.5 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </main>
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 rounded-full border border-vx-border bg-vx-card px-4 py-2 text-sm text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          Back to top
        </button>
      )}
      <Footer />
    </div>
  );
}
