"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { IntentComparePanel, MAX_COMPARE_INTENTS } from "@/components/IntentComparePanel";
import { SkeletonCard } from "@/components/Skeleton";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { buildIntentsCsv, downloadCsv } from "@/lib/csv";
import { CHAINS } from "@/lib/marketData";
import {
  STATUS_OPTIONS,
  readChain,
  readSort,
  readStatus,
  type SortOption,
} from "@/lib/searchQuery";
import type { SortSpec } from "@/lib/solverRanking";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

const PAGE_SIZE = 10;
const BACK_TO_TOP_OFFSET = 400;

const COLUMN_IDS = ["amount", "chain", "solver", "status", "time"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];
/** The row-header column can never be hidden. */
const ALWAYS_VISIBLE: readonly ColumnId[] = ["amount"];
const COLUMNS_STORAGE_KEY = "vortex:columns:explore";

const COLUMN_LABELS: Record<ColumnId, string> = {
  amount: "Amount",
  chain: "Chain",
  solver: "Solver",
  status: "Status",
  time: "Time",
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  largest: "Largest first",
};

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

function sortSpecs(sort: SortOption): SortSpec<ColumnId>[] {
  if (sort === "largest") return [{ key: "amount", dir: "desc" }];
  return [{ key: "time", dir: sort === "oldest" ? "asc" : "desc" }];
}

function sortIntents(items: FeedItem[], sort: SortOption): FeedItem[] {
  const copy = [...items];
  if (sort === "largest") return copy.sort((a, b) => Number(b.srcAmount) - Number(a.srcAmount));
  const dir = sort === "oldest" ? 1 : -1;
  return copy.sort((a, b) => dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: readStatus(params.get("status")),
    chain: readChain(params.get("chain")),
    sort: readSort(params.get("sort")),
  };
}

function ColumnsMenu({
  visibility,
  isToggleable,
  onToggle,
}: {
  visibility: Record<ColumnId, boolean>;
  isToggleable: (column: ColumnId) => boolean;
  onToggle: (column: ColumnId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="explore-columns-menu"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-text hover:bg-vx-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
      >
        Columns
      </button>
      {open && (
        <div
          id="explore-columns-menu"
          role="group"
          aria-label="Visible columns"
          className="absolute right-0 z-20 mt-2 min-w-[11rem] rounded-lg border border-vx-border bg-vx-card p-2 shadow-lg"
        >
          {COLUMN_IDS.map((id) => {
            const locked = !isToggleable(id);
            return (
              <label
                key={id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm text-vx-text focus-within:ring-2 focus-within:ring-vx-sage ${
                  locked ? "opacity-60" : "cursor-pointer hover:bg-vx-surface/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={visibility[id]}
                  disabled={locked}
                  onChange={() => onToggle(id)}
                  className="accent-vx-sage"
                />
                {COLUMN_LABELS[id]}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExplorePageClient() {
  const { intents, isLoading, error, isLive } = useLiveIntents();
  const { visibility, toggle, isToggleable } = useColumnVisibility<ColumnId>(
    COLUMNS_STORAGE_KEY,
    COLUMN_IDS,
    ALWAYS_VISIBLE,
  );

  const [filters, setFilters] = useState(readUrlState);
  const [page, setPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const selected = useMemo(
    () => intents.filter((item) => selectedKeys.includes(item.id)),
    [intents, selectedKeys],
  );
  const canCompare = selected.length >= 2;

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > BACK_TO_TOP_OFFSET);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const updateFilters = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams(window.location.search);
    const defaults = { status: "all", chain: "all", sort: "newest" } as const;
    for (const key of ["status", "chain", "sort"] as const) {
      if (next[key] === defaults[key]) params.delete(key);
      else params.set(key, next[key]);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const filtered = useMemo(() => {
    const matching = intents.filter(
      (i) =>
        (filters.status === "all" || i.status === filters.status) &&
        (filters.chain === "all" || i.srcChain === filters.chain),
    );
    return sortIntents(matching, filters.sort);
  }, [intents, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns = useMemo<DataTableColumn<FeedItem, ColumnId>[]>(() => {
    const all: DataTableColumn<FeedItem, ColumnId>[] = [
      {
        id: "amount",
        header: COLUMN_LABELS.amount,
        sortable: true,
        isRowHeader: true,
        cell: (row) => (
          <Link href={`/explore/${encodeURIComponent(row.id)}`} className="text-vx-text hover:text-vx-sage focus-visible:ring-2 focus-visible:ring-vx-sage rounded">
            {sanitizeDisplayText(`${row.srcAmount} ${row.srcToken} → ${row.dstToken}`)}
          </Link>
        ),
      },
      { id: "chain", header: COLUMN_LABELS.chain, cell: (row) => <span className="capitalize">{sanitizeDisplayText(row.srcChain)}</span> },
      { id: "solver", header: COLUMN_LABELS.solver, cell: (row) => sanitizeDisplayText(row.solver ?? "—") },
      { id: "status", header: COLUMN_LABELS.status, cell: (row) => <span className="capitalize">{row.status}</span> },
      {
        id: "time",
        header: COLUMN_LABELS.time,
        sortable: true,
        align: "right",
        cell: (row) => <RelativeTimeCell iso={row.createdAt} />,
      },
    ];
    return all.filter((col) => visibility[col.id]);
  }, [visibility]);

  const handleSort = (key: ColumnId) => {
    if (key === "amount") updateFilters({ sort: filters.sort === "largest" ? "newest" : "largest" });
    else if (key === "time") updateFilters({ sort: filters.sort === "newest" ? "oldest" : "newest" });
  };

  const exportCsv = () => downloadCsv("vortex-intents.csv", buildIntentsCsv(filtered));

  const selectClass =
    "rounded-lg border border-vx-border bg-vx-card px-3 py-1.5 text-sm text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-vx-text mb-2">Explore intents</h1>
          <p className="text-sm text-vx-muted">Browse swap intents and their fills across chains.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => updateFilters({ status: readStatus(e.target.value) })}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by chain"
            value={filters.chain}
            onChange={(e) => updateFilters({ chain: readChain(e.target.value) })}
            className={selectClass}
          >
            <option value="all">All chains</option>
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort order"
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: readSort(e.target.value) })}
            className={selectClass}
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-vx-muted" aria-live="polite">
              {isLive ? "Live" : "Polling"}
            </span>
            <span className="text-xs text-vx-muted">
              {filtered.length} {filtered.length === 1 ? "intent" : "intents"}
            </span>
            <ColumnsMenu visibility={visibility} isToggleable={isToggleable} onToggle={toggle} />
            <button
              type="button"
              onClick={exportCsv}
              className="text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-text hover:bg-vx-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-xs text-vx-muted" aria-live="polite">
            {canCompare
              ? `${selected.length} of ${MAX_COMPARE_INTENTS} intents selected`
              : `Select up to ${MAX_COMPARE_INTENTS} intents to compare`}
          </p>
          {canCompare && (
            <button
              type="button"
              onClick={() => setComparing((open) => !open)}
              aria-expanded={comparing}
              className="rounded-lg border border-vx-border px-3 py-1.5 text-xs text-vx-text hover:bg-vx-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {comparing ? "Close comparison" : `Compare (${selected.length})`}
            </button>
          )}
        </div>

        {canCompare && comparing && (
          <div className="mb-4">
            <IntentComparePanel intents={selected} />
          </div>
        )}

        {isLoading && intents.length === 0 ? (
          <SkeletonCard rows={6} rowHeight="h-14" />
        ) : error ? (
          <EmptyState variant="error" message="Couldn't load intents right now. Please try again shortly." />
        ) : filtered.length === 0 ? (
          <EmptyState message="No intents match your filters." />
        ) : (
          <div className="card overflow-hidden">
            <DataTable
              caption="Swap intents"
              sortHint="Activate a column header to sort"
              columns={columns}
              rows={pageRows}
              getRowKey={(row) => row.id}
              sorts={sortSpecs(filters.sort)}
              onSort={handleSort}
              selectable
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              selectionLimit={MAX_COMPARE_INTENTS}
              selectionLabels={{
                column: "Select",
                row: (row) => `Select ${row.srcAmount} ${row.srcToken} → ${row.dstToken}`,
              }}
            />
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-vx-muted">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg border border-vx-border disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              Previous
            </button>
            <span>{`Page ${currentPage} of ${totalPages}`}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg border border-vx-border disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              Next
            </button>
          </nav>
        )}
      </main>
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 rounded-full border border-vx-border bg-vx-card px-4 py-2 text-sm text-vx-text shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          Back to top
        </button>
      )}
      <Footer />
    </div>
  );
}
