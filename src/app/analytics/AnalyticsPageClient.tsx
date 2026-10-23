"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import {
  computeAnalytics,
  getStatusDistributionEntries,
  computeShareSeries,
  computeConcentration,
  computeTopMovers,
  SLA_THRESHOLDS,
  type ShareDimension,
  type ShareSeriesPoint,
  type TopMover,
  type ConcentrationResult,
  type AnalyticsResult,
  type KpiCard,
  type KpiDeltaState,
  type SankeyData,
  type SlaPanelData,
} from "@/lib/analytics";
import { CHAINS } from "@/lib/marketData";
import {
  buildAnalyticsCsvBundle,
  buildShareUrl,
  readShareStateFromUrl,
  SHARE_PARAM,
  type AnalyticsShareState,
} from "@/lib/export/analyticsExport";
import { downloadBlob, svgToPng } from "@/lib/export/svgToPng";
import { downloadCsv } from "@/lib/csv";
import { secureLogger } from "@/lib/secureLogging";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Tooltip } from "@/components/Tooltip";
import { useSlaBreachAlert } from "@/hooks/useSlaBreachAlert";

// ─── Inline format helper ─────────────────────────────────────────────────────

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

// ─── LineChart ────────────────────────────────────────────────────────────────

function LineChart({ points }: { points: { date: string; totalVolumeUsd: number }[] }) {
  const { t } = useTranslation();
  const reducedMotion =
    typeof window !== "undefined" &&
    document.documentElement.dataset["motion"] === "reduce";
  const width = 640;
  const height = 180;
  const padding = 24;

  if (points.length === 0) {
    return <div className="text-sm text-vx-muted">{t("analytics.chart.empty")}</div>;
  }

  const maxValue = Math.max(...points.map((p) => p.totalVolumeUsd), 1);
  const minValue = Math.min(...points.map((p) => p.totalVolumeUsd), 0);
  const range = Math.max(maxValue - minValue, 1);

  const path = points
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.totalVolumeUsd - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label={t("analytics.chart.aria")}
      >
        <g>
          {Array.from({ length: 4 }).map((_, index) => {
            const y = padding + (index / 3) * (height - padding * 2);
            return (
              <line
                key={y}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}
          <path
            d={path}
            fill="none"
            stroke="#4CEBA8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={reducedMotion ? "" : "transition-all duration-300"}
          />
        </g>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide text-vx-muted">
        {points.slice(0, 3).map((point) => (
          <div key={point.date} className="num">
            {new Date(point.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline (issue #467) ───────────────────────────────────────────────────

function Sparkline({ data, color = "#4CEBA8" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const width = 80;
  const height = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI card (issue #467) ────────────────────────────────────────────────────

const DELTA_COLORS: Record<KpiDeltaState, string> = {
  up: "text-emerald-400",
  down: "text-red-400",
  neutral: "text-vx-muted",
  new: "text-sky-400",
  "no-data": "text-vx-dim",
};

const DELTA_ARROWS: Record<KpiDeltaState, string> = {
  up: "▲",
  down: "▼",
  neutral: "—",
  new: "★",
  "no-data": "",
};

function KpiCardComponent({
  label,
  tooltip,
  card,
}: {
  label: string;
  tooltip: string;
  card: KpiCard;
}) {
  const deltaPercent =
    card.delta !== undefined && card.value !== 0
      ? Math.abs((card.delta / (card.value - card.delta)) * 100)
      : undefined;

  const deltaLabel = buildDeltaAriaLabel(card.state, deltaPercent);

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">{label}</div>
        <Tooltip content={tooltip}>
          <button
            type="button"
            className="rounded text-vx-dim hover:text-vx-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent text-xs"
            aria-label={`${label} definition`}
          >
            ⓘ
          </button>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between gap-2">
        <Tooltip content={card.formattedFull}>
          <span className="text-2xl font-semibold text-vx-text num cursor-default">
            {card.formatted}
          </span>
        </Tooltip>
        <Sparkline data={card.sparkline} />
      </div>

      {card.state !== "no-data" && (
        <div
          className={`text-xs ${DELTA_COLORS[card.state]}`}
          aria-label={deltaLabel}
        >
          {DELTA_ARROWS[card.state]}{" "}
          {deltaPercent !== undefined
            ? `${deltaPercent.toFixed(1)}% vs prior period`
            : card.state === "new"
              ? "New activity"
              : "No change"}
        </div>
      )}
    </div>
  );
}

function buildDeltaAriaLabel(state: KpiDeltaState, percent?: number): string {
  if (state === "up") return `Up ${percent?.toFixed(1) ?? "0"}% versus prior period`;
  if (state === "down") return `Down ${percent?.toFixed(1) ?? "0"}% versus prior period`;
  if (state === "neutral") return "No significant change versus prior period";
  if (state === "new") return "New activity — no prior period data";
  return "No prior period data available";
}

// ─── Simple Tooltip wrapper ───────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block z-50 w-max max-w-xs rounded bg-vx-surface border border-vx-border px-2 py-1 text-xs text-vx-text shadow-lg"
      >
        {content}
      </span>
    </span>
  );
}

// ─── Data-completeness banner (issue #467) ────────────────────────────────────

function DataQualityBanner({
  isCapped,
  datasetSize,
  datasetSince,
}: {
  isCapped: boolean;
  datasetSize: number;
  datasetSince: string | undefined;
}) {
  if (!isCapped) return null;
  const sinceStr = datasetSince
    ? new Date(datasetSince).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "unknown";

  return (
    <aside
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 flex flex-wrap items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        Based on the latest{" "}
        <strong className="font-semibold num">{datasetSize}</strong> intents
        {datasetSince && (
          <>
            {" "}(since <time dateTime={datasetSince}>{sinceStr}</time>)
          </>
        )}
        . Data may be partial —{" "}
        <a
          href="https://github.com/stellar-vortex-protocol/vortex-frontend/blob/main/docs/architecture.md"
          className="underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
          target="_blank"
          rel="noopener noreferrer"
        >
          learn about data limitations
        </a>
        .
      </span>
    </aside>
  );
}

// ─── BarList ──────────────────────────────────────────────────────────────────

function BarList({
  items,
  formatLabel,
  total,
}: {
  items: { label: string; value: number; percent: number; color: string }[];
  formatLabel?: (value: string) => string;
  total: number;
}) {
  const { t } = useTranslation();

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-sm text-vx-muted">{t("analytics.bars.empty")}</div>
      ) : (
        items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
              <span className="truncate">
                {formatLabel ? formatLabel(item.label) : item.label}
              </span>
              <span className="num">{formatUsd(item.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-vx-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-vx-dim">
              {t("analytics.bars.percent", { percent: Math.round(item.percent) })}
            </div>
          </div>
        ))
      )}
      {total === 0 && (
        <div className="text-xs text-vx-muted">{t("analytics.bars.noVolume")}</div>
      )}
    </div>
  );
}

// ─── StatusBreakdown ──────────────────────────────────────────────────────────

function StatusBreakdown({
  counts,
}: {
  counts: ReturnType<typeof getStatusDistributionEntries>;
}) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const { t } = useTranslation();
  const labels = {
    pending: t("intent.status.pending"),
    accepted: t("intent.status.accepted"),
    filled: t("intent.status.filled"),
    failed: t("intent.status.failed"),
  } as const;

  return (
    <div className="space-y-3">
      {counts.map((item) => (
        <div key={item.status} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
            <span>{labels[item.status]}</span>
            <span className="num">{item.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-vx-surface">
            <div
              className="h-full rounded-full"
              style={{
                width: `${total === 0 ? 0 : (item.count / total) * 100}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Drives analytics from a Web Worker when available, falling back to a
 * synchronous recompute on the main thread (SSR, tests, old browsers).
 * The worker keeps an incremental aggregator alive and streams snapshots
 * back, so the main thread only ever renders precomputed results.
 */
function useAnalyticsWorker(intents: Parameters<typeof computeAnalytics>[0]) {
  const [snapshot, setSnapshot] = useState<AnalyticsResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL("../../lib/analytics/worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }

    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; snapshot?: AnalyticsResult }>) => {
      if (event.data?.type === "snapshot" && event.data.snapshot) {
        setSnapshot(event.data.snapshot);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      worker.postMessage({ type: "init", intents });
    } else {
      worker.postMessage({ type: "apply", delta: { type: "replace", intents } });
    }
  }, [intents]);

  return snapshot;
}

// ─── SLA Panel (issue #465) ───────────────────────────────────────────────────

function SlaPanel({ data }: { data: SlaPanelData }) {
  useSlaBreachAlert(data);
  const { percentiles, histogram, sla, filledCount, pendingCount, clampedCount, successRateMovingAvg } = data;

  if (filledCount === 0) {
    return (
      <div className="text-sm text-vx-muted" role="status">
        No filled intents with fill-time data available yet.
      </div>
    );
  }

  const binLabel = (lower: number, upper: number) =>
    upper === Number.POSITIVE_INFINITY ? `${lower}s+` : `${lower}–${upper}s`;

  const maxBinCount = Math.max(...histogram.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* Percentile cards */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-vx-dim">
          Nearest-rank percentile — p50 means 50% of fills completed within this time.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { label: "p50 (median)", value: percentiles.p50, pass: sla.p50, threshold: SLA_THRESHOLDS.p50MaxSeconds },
              { label: "p90", value: percentiles.p90, pass: sla.p90, threshold: SLA_THRESHOLDS.p90MaxSeconds },
              { label: "p99", value: percentiles.p99, pass: sla.p99, threshold: SLA_THRESHOLDS.p99MaxSeconds },
            ] as const
          ).map(({ label, value, pass, threshold }) => (
            <div
              key={label}
              className={`rounded-lg border p-3 ${pass ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}
            >
              <div className="eyebrow">{label}</div>
              <div className="mt-1 text-xl font-semibold num text-vx-text">
                {value.toFixed(1)}s
              </div>
              <div
                className={`mt-1 flex items-center gap-1 text-xs font-medium ${pass ? "text-emerald-400" : "text-red-400"}`}
                aria-label={`${label}: ${pass ? "Pass" : "Fail"} — SLA threshold is ${threshold} seconds`}
              >
                <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
                {pass ? "Pass" : "Fail"} (SLA: {threshold}s)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Histogram */}
      <div>
        <div className="eyebrow mb-2">Fill-time distribution</div>
        <div className="flex items-end gap-1 h-24" role="img" aria-label="Fill-time histogram">
          {histogram.map((bin) => (
            <Tooltip
              key={`${bin.lower}-${bin.upper}`}
              content={`${binLabel(bin.lower, bin.upper)}: ${bin.count} intent(s)`}
            >
              <div className="flex flex-1 flex-col items-center gap-1 cursor-default">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(bin.count / maxBinCount) * 80}px`,
                    background: bin.count > 0 ? "#4CEBA8" : "rgba(255,255,255,0.08)",
                  }}
                />
                <span className="text-[8px] text-vx-dim rotate-0 leading-none">
                  {bin.lower}s
                </span>
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-vx-dim">Time to fill (seconds)</div>
      </div>

      {/* Success rate sparkline */}
      {successRateMovingAvg.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Success rate (7-day moving avg.)</div>
          <div className="h-20">
            <svg
              viewBox={`0 0 400 60`}
              className="w-full h-full"
              role="img"
              aria-label="7-day moving average success rate chart"
            >
              {(() => {
                const pts = successRateMovingAvg;
                const path = pts
                  .map((p, i) => {
                    const x = (i / Math.max(pts.length - 1, 1)) * 400;
                    const y = 60 - (p.rate / 100) * 60;
                    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <path
                    d={path}
                    fill="none"
                    stroke="#4CEBA8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* Data quality notes */}
      <div className="space-y-1 text-[11px] text-vx-dim">
        {pendingCount > 0 && (
          <p>{pendingCount} still-pending intent(s) excluded from fill-time stats.</p>
        )}
        {clampedCount > 0 && (
          <p>{clampedCount} intent(s) with negative duration clamped to 0 (clock skew).</p>
        )}
        <p>{filledCount} filled intent(s) included in analysis.</p>
      </div>
    </div>
  );
}

// ─── Route Flow SVG Sankey (issue #464 & #603) ─────────────────────────────────

function RouteFlowSankeySvg({
  chainNodes,
  tokenNodes,
  links,
  totalValue,
  chainMeta,
  focusedId,
  setFocusedId,
  onExploreClick,
  t,
}: {
  chainNodes: { id: string; label: string; color: string; totalValue?: number; value?: number }[];
  tokenNodes: { id: string; label: string; color: string; totalValue?: number; value?: number }[];
  links: { sourceId: string; targetId: string; value: number; count: number }[];
  totalValue: number;
  chainMeta: Record<string, { id: string; name: string; color: string }>;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  onExploreClick: (chainId: string, tokenSymbol: string) => void;
  t: (key: any) => string;
}) {
  const width = 640;
  const height = 220;
  const paddingY = 20;
  const x0 = 80;
  const x1 = 540;
  const nodeW = 14;
  const gap = 10;

  const getNodeVal = (node?: { totalValue?: number; value?: number }) =>
    node?.totalValue ?? node?.value ?? 0;

  const sumChain = Math.max(1, chainNodes.reduce((s, n) => s + getNodeVal(n), 0));
  const sumToken = Math.max(1, tokenNodes.reduce((s, n) => s + getNodeVal(n), 0));

  const availHChains = Math.max(40, height - paddingY * 2 - (chainNodes.length - 1) * gap);
  const availHTokens = Math.max(40, height - paddingY * 2 - (tokenNodes.length - 1) * gap);

  // Compute node rectangles
  let curYChain = paddingY;
  const chainLayouts = new Map<string, { x: number; y: number; w: number; h: number; curY: number }>();
  chainNodes.forEach((node) => {
    const val = getNodeVal(node);
    const h = Math.max(14, (val / sumChain) * availHChains);
    chainLayouts.set(node.id, { x: x0, y: curYChain, w: nodeW, h, curY: curYChain });
    curYChain += h + gap;
  });

  let curYToken = paddingY;
  const tokenLayouts = new Map<string, { x: number; y: number; w: number; h: number; curY: number }>();
  tokenNodes.forEach((node) => {
    const val = getNodeVal(node);
    const h = Math.max(14, (val / sumToken) * availHTokens);
    tokenLayouts.set(node.id, { x: x1, y: curYToken, w: nodeW, h, curY: curYToken });
    curYToken += h + gap;
  });

  // Compute flow ribbon paths
  const ribbonPaths = links.map((link) => {
    const src = chainLayouts.get(link.sourceId);
    const dst = tokenLayouts.get(link.targetId);
    if (!src || !dst) return null;

    const srcNode = chainNodes.find((n) => n.id === link.sourceId);
    const dstNode = tokenNodes.find((n) => n.id === link.targetId);

    const srcVal = getNodeVal(srcNode);
    const dstVal = getNodeVal(dstNode);

    const hSrc = srcVal > 0 ? Math.max(2, (link.value / srcVal) * src.h) : 2;
    const hDst = dstVal > 0 ? Math.max(2, (link.value / dstVal) * dst.h) : 2;

    const y0Top = src.curY;
    const y0Bot = y0Top + hSrc;
    src.curY += hSrc;

    const y1Top = dst.curY;
    const y1Bot = y1Top + hDst;
    dst.curY += hDst;

    const startX = src.x + src.w;
    const endX = dst.x;
    const dx = (endX - startX) * 0.5;

    const d = `M ${startX} ${y0Top} C ${startX + dx} ${y0Top}, ${endX - dx} ${y1Top}, ${endX} ${y1Top} L ${endX} ${y1Bot} C ${endX - dx} ${y1Bot}, ${startX + dx} ${y0Bot}, ${startX} ${y0Bot} Z`;

    const chainId = link.sourceId.replace("chain:", "");
    const tokenSymbol = dstNode?.label ?? "";
    const isFocused = focusedId === `${link.sourceId}→${link.targetId}`;

    return {
      id: `${link.sourceId}→${link.targetId}`,
      d,
      color: srcNode?.color ?? "#4CEBA8",
      label: `${srcNode?.label ?? chainId} → ${tokenSymbol}: ${formatUsd(link.value)} across ${link.count} intent(s)`,
      chainId,
      tokenSymbol,
      isFocused,
    };
  }).filter(Boolean);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto min-h-[220px]"
      role="img"
      aria-label={t("analytics.routeFlow.diagramAria") || "Route flow Sankey diagram"}
    >
      <defs>
        <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Ribbons */}
      <g className="ribbons">
        {ribbonPaths.map((ribbon) => (
          <path
            key={ribbon!.id}
            d={ribbon!.d}
            fill={ribbon!.color}
            fillOpacity={ribbon!.isFocused ? 0.8 : 0.35}
            stroke={ribbon!.color}
            strokeWidth={ribbon!.isFocused ? 1.5 : 0.5}
            strokeOpacity={ribbon!.isFocused ? 0.9 : 0.3}
            className="cursor-pointer transition-all duration-200"
            onMouseEnter={() => setFocusedId(ribbon!.id)}
            onMouseLeave={() => setFocusedId(null)}
            onClick={() => onExploreClick(ribbon!.chainId, ribbon!.tokenSymbol)}
          >
            <title>{ribbon!.label}</title>
          </path>
        ))}
      </g>

      {/* Source chain nodes */}
      <g className="chain-nodes">
        {chainNodes.map((node) => {
          const layout = chainLayouts.get(node.id);
          if (!layout) return null;
          const chainId = node.id.replace("chain:", "");
          const name = chainMeta[chainId]?.name ?? node.label;
          return (
            <g key={node.id} className="cursor-pointer" onClick={() => onExploreClick(chainId, "")}>
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.w}
                height={layout.h}
                rx={3}
                fill={node.color}
                filter="url(#glow)"
              />
              <text
                x={layout.x - 8}
                y={layout.y + layout.h / 2 + 4}
                textAnchor="end"
                fill="currentColor"
                fontSize="11"
                className="fill-vx-text font-medium"
              >
                {name}
              </text>
            </g>
          );
        })}
      </g>

      {/* Destination token nodes */}
      <g className="token-nodes">
        {tokenNodes.map((node) => {
          const layout = tokenLayouts.get(node.id);
          if (!layout) return null;
          return (
            <g key={node.id}>
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.w}
                height={layout.h}
                rx={3}
                fill={node.color}
                filter="url(#glow)"
              />
              <text
                x={layout.x + layout.w + 8}
                y={layout.y + layout.h / 2 + 4}
                textAnchor="start"
                fill="currentColor"
                fontSize="11"
                className="fill-vx-text font-medium"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function RouteFlowPanel({
  sankeyData,
  chainMeta,
}: {
  sankeyData: SankeyData;
  chainMeta: Record<string, { id: string; name: string; color: string }>;
}) {
  const { t } = useTranslation();
  const [minVolumeThreshold, setMinVolumeThreshold] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const flowChartRef = useRef<HTMLDivElement>(null);

  const { nodes, links, totalValue } = sankeyData;

  const chainNodes = nodes.filter((n) => n.id.startsWith("chain:"));
  const tokenNodes = nodes.filter((n) => n.id.startsWith("token:"));

  const filteredLinks = links.filter((l) => l.value >= minVolumeThreshold);

  // Matrix heatmap data
  const heatmapRows = useMemo(() => {
    return chainNodes.map((chainNode) => ({
      chainNode,
      cells: tokenNodes.map((tokenNode) => {
        const link = filteredLinks.find(
          (l) => l.sourceId === chainNode.id && l.targetId === tokenNode.id,
        );
        return { tokenNode, link };
      }),
    }));
  }, [chainNodes, tokenNodes, filteredLinks]);

  const maxCellValue = Math.max(...filteredLinks.map((l) => l.value), 1);

  const handleExploreClick = useCallback(
    (chainId: string, tokenSymbol: string) => {
      const params = new URLSearchParams();
      params.set("chain", chainId);
      if (tokenSymbol) params.set("q", `token:${tokenSymbol}`);
      window.location.href = `/explore?${params.toString()}`;
    },
    [],
  );

  const handlePngExport = useCallback(
    async (forcedTheme?: "light" | "dark") => {
      const svgEl = flowChartRef.current?.querySelector("svg");
      if (!svgEl) {
        secureLogger.warn("Route flow PNG export: no SVG element found in flow container");
        return;
      }
      try {
        const isLight =
          typeof document !== "undefined" &&
          document.documentElement.getAttribute("data-theme") === "light";
        const activeTheme = forcedTheme ?? (isLight ? "light" : "dark");
        const bg = activeTheme === "light" ? "#ffffff" : "#0f1117";
        const blob = await svgToPng(svgEl as SVGSVGElement, { background: bg });
        const today = new Date().toISOString().slice(0, 10);
        downloadBlob(blob, `vortex-route-flow-${today}.png`);
      } catch (err) {
        secureLogger.error("Route flow PNG export failed", err);
      }
    },
    [],
  );

  if (nodes.length === 0) {
    return <div className="text-sm text-vx-muted">No route data available.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Threshold slider and actions */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-vx-muted">
        <label htmlFor="vol-threshold" className="shrink-0">
          {t("analytics.routeFlow.threshold") || "Min. volume threshold:"}
        </label>
        <input
          id="vol-threshold"
          type="range"
          min={0}
          max={Math.round(totalValue / 10)}
          step={Math.max(1, Math.round(totalValue / 100))}
          value={minVolumeThreshold}
          onChange={(e) => setMinVolumeThreshold(Number(e.target.value))}
          className="w-32 accent-vx-accent"
          aria-label="Minimum volume threshold to show a route"
        />
        <span className="num">{formatUsd(minVolumeThreshold)}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="rounded border border-vx-border bg-vx-surface px-2 py-1 text-xs hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
            aria-pressed={showTable}
          >
            {showTable
              ? (t("analytics.routeFlow.hideTable") || "Hide table")
              : (t("analytics.routeFlow.showTable") || "Show table")}
          </button>
          <button
            type="button"
            onClick={() => handlePngExport()}
            className="rounded border border-vx-border bg-vx-surface px-2 py-1 text-xs hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent flex items-center gap-1.5"
            aria-label={t("analytics.routeFlow.exportPng") || "Export as PNG"}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>{t("analytics.routeFlow.exportPng") || "Export as PNG"}</span>
          </button>
        </div>
      </div>

      {/* Visual Sankey Diagram & Matrix */}
      {!showTable && (
        <div className="space-y-4">
          <div ref={flowChartRef} className="overflow-x-auto rounded-lg border border-vx-border/40 bg-vx-surface/30 p-3">
            <RouteFlowSankeySvg
              chainNodes={chainNodes}
              tokenNodes={tokenNodes}
              links={filteredLinks}
              totalValue={totalValue}
              chainMeta={chainMeta}
              focusedId={focusedId}
              setFocusedId={setFocusedId}
              onExploreClick={handleExploreClick}
              t={t}
            />
          </div>

          {/* Matrix heatmap view */}
          <div
            className="overflow-x-auto"
            role="img"
            aria-label="Route flow heatmap: source chains vs destination tokens"
          >
            <table className="border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="text-left text-vx-muted pr-2 font-normal">
                    <span className="sr-only">Source chain</span>
                  </th>
                  {tokenNodes.map((tn) => (
                    <th
                      key={tn.id}
                      className="text-center text-vx-muted font-normal pb-1 px-1"
                      scope="col"
                      style={{ color: tn.color }}
                    >
                      {tn.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map(({ chainNode, cells }) => (
                  <tr key={chainNode.id}>
                    <th
                      scope="row"
                      className="text-left text-vx-muted font-normal pr-2 whitespace-nowrap"
                      style={{ color: chainNode.color }}
                    >
                      {chainMeta[chainNode.id.replace("chain:", "")]?.name ??
                        chainNode.label}
                    </th>
                    {cells.map(({ tokenNode, link }) => {
                      const opacity = link
                        ? 0.15 + (link.value / maxCellValue) * 0.85
                        : 0;
                      const isFocused =
                        focusedId === `${chainNode.id}→${tokenNode.id}`;
                      return (
                        <td key={tokenNode.id} className="p-0">
                          {link ? (
                            <Tooltip
                              content={`${chainNode.label} → ${tokenNode.label}: ${formatUsd(link.value)} across ${link.count} intent(s) (${((link.value / totalValue) * 100).toFixed(1)}%)`}
                            >
                              <button
                                type="button"
                                className={`h-8 w-14 rounded transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent ${isFocused ? "ring-2 ring-vx-accent" : ""}`}
                                style={{
                                  background: chainNode.color,
                                  opacity,
                                }}
                                onFocus={() =>
                                  setFocusedId(`${chainNode.id}→${tokenNode.id}`)
                                }
                                onBlur={() => setFocusedId(null)}
                                onClick={() =>
                                  handleExploreClick(
                                    chainNode.id.replace("chain:", ""),
                                    tokenNode.label,
                                  )
                                }
                                aria-label={`${chainNode.label} to ${tokenNode.label}: ${formatUsd(link.value)}, ${link.count} intent(s). Click to explore.`}
                              />
                            </Tooltip>
                          ) : (
                            <div
                              className="h-8 w-14 rounded"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table alternative */}
      {showTable && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs" aria-label="All routes sortable table">
            <thead className="text-vx-muted uppercase tracking-wide text-[10px]">
              <tr>
                <th className="pb-3 pr-4">Route</th>
                <th className="pb-3 pr-4">Volume</th>
                <th className="pb-3 pr-4">Intents</th>
                <th className="pb-3 pr-4">Share</th>
                <th className="pb-3">Explore</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map((link) => {
                const chainId = link.sourceId.replace("chain:", "");
                const tokenSymbol = link.targetId.replace("token:", "");
                const chainName =
                  chainMeta[chainId]?.name ?? chainId;
                return (
                  <tr
                    key={`${link.sourceId}-${link.targetId}`}
                    className="border-t border-vx-border/80 text-vx-text"
                  >
                    <td className="py-2 pr-4">
                      {chainName} → {tokenSymbol}
                    </td>
                    <td className="py-2 pr-4 num">{formatUsd(link.value)}</td>
                    <td className="py-2 pr-4 num">{link.count}</td>
                    <td className="py-2 pr-4 num">
                      {((link.value / totalValue) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleExploreClick(chainId, tokenSymbol)}
                        className="text-vx-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent text-xs"
                        aria-label={`Explore ${chainName} to ${tokenSymbol} intents`}
                      >
                        Explore →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Export menu (issue #466) ─────────────────────────────────────────────────

function ExportMenu({
  onCsv,
  onPng,
  onCopyLink,
}: {
  onCsv: () => void;
  onPng: (theme: "light" | "dark") => void;
  onCopyLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Export analytics snapshot"
        className="rounded-lg border border-vx-border bg-vx-surface/60 px-3 py-2 text-xs text-vx-muted hover:bg-vx-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
      >
        Export ▾
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-vx-border bg-vx-surface shadow-lg"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent rounded-t-lg"
            onClick={() => { onCsv(); setOpen(false); }}
          >
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
            onClick={() => { onPng("dark"); setOpen(false); }}
          >
            Download PNG (dark)
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
            onClick={() => { onPng("light"); setOpen(false); }}
          >
            Download PNG (light)
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent rounded-b-lg"
            onClick={() => { handleCopyLink(); setOpen(false); }}
          >
            {linkCopied ? "Link copied! ✓" : "Copy shareable link"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Issue #468 helper components ─────────────────────────────────────────────

function StackedAreaChart({
  seriesData,
  entities,
  colors,
  normalized,
}: {
  seriesData: ShareSeriesPoint[];
  entities: string[];
  colors: Record<string, string>;
  normalized: boolean;
}) {
  if (seriesData.length === 0) {
    return <div className="text-sm text-vx-muted">No market-share trend data available.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="h-48 w-full overflow-hidden rounded bg-vx-surface/40 p-2 flex items-center justify-center text-xs text-vx-muted">
        <svg viewBox="0 0 600 160" className="w-full h-full" role="img" aria-label="Market share trends chart">
          <g>
            {entities.map((entity, i) => (
              <text key={entity} x={20 + i * 100} y={20} fill={colors[entity] ?? "#4CEBA8"} fontSize="11">
                {entity}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-vx-muted">
        {entities.map((entity) => (
          <div key={entity} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[entity] ?? "#4CEBA8" }} />
            <span>{entity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopMoversPanel({ movers }: { movers: TopMover[] }) {
  if (movers.length === 0) {
    return <div className="text-sm text-vx-muted">No share shifts detected.</div>;
  }
  return (
    <div className="space-y-2">
      {movers.slice(0, 5).map((m) => (
        <div key={m.label} className="flex items-center justify-between text-xs py-1 border-b border-vx-border/40">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            <span className="font-medium text-vx-text">{m.label}</span>
          </div>
          <div className="flex items-center gap-3 num">
            <span className="text-vx-muted">{m.currentSharePct}%</span>
            <span className={m.deltaSharePct >= 0 ? "text-vx-accent" : "text-vx-dim"}>
              {m.deltaSharePct >= 0 ? `▲ +${m.deltaSharePct}%` : `▼ ${m.deltaSharePct}%`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConcentrationIndicator({ result }: { result: ConcentrationResult }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-vx-muted">HHI Index</span>
        <Tooltip content={`Herfindahl–Hirschman Index: ${result.hhi} (${result.level})`}>
          <span className="font-semibold num text-vx-text">{result.hhi} ({result.level})</span>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-vx-surface/60 p-2.5 border border-vx-border/60">
          <div className="text-vx-dim">Top-1 Share</div>
          <div className="text-base font-semibold text-vx-text num mt-1">{result.top1SharePct}%</div>
        </div>
        <div className="rounded bg-vx-surface/60 p-2.5 border border-vx-border/60">
          <div className="text-vx-dim">Top-3 Share</div>
          <div className="text-base font-semibold text-vx-text num mt-1">{result.top3SharePct}%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error } = useLiveIntents();
  const chartRef = useRef<HTMLDivElement>(null);

  // Filter states restored from URL (#601)
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  useEffect(() => {
    const shared = readShareStateFromUrl();
    if (shared) {
      if (shared.chain) setSelectedChain(shared.chain);
      if (shared.token) setSelectedToken(shared.token);
      if (shared.from) setDateFrom(shared.from);
      if (shared.to) setDateTo(shared.to);
    }
  }, []);

  const filteredIntents = useMemo(() => {
    if (!selectedChain && !selectedToken && !dateFrom && !dateTo) {
      return intents;
    }
    return intents.filter((intent) => {
      if (selectedChain && intent.srcChain !== selectedChain) return false;
      if (
        selectedToken &&
        intent.srcToken !== selectedToken &&
        intent.dstToken !== selectedToken
      ) {
        return false;
      }
      if (dateFrom && new Date(intent.createdAt).getTime() < new Date(dateFrom).getTime()) {
        return false;
      }
      if (dateTo && new Date(intent.createdAt).getTime() > new Date(dateTo).getTime()) {
        return false;
      }
      return true;
    });
  }, [intents, selectedChain, selectedToken, dateFrom, dateTo]);

  const workerSnapshot = useAnalyticsWorker(filteredIntents);
  const fallbackAnalytics = useMemo(
    () => (workerSnapshot ? null : computeAnalytics(filteredIntents)),
    [workerSnapshot, filteredIntents],
  );
  const analytics = workerSnapshot ?? fallbackAnalytics!;
  const deferredAnalytics = useDeferredValue(analytics);
  const statusEntries = useMemo(
    () => getStatusDistributionEntries(deferredAnalytics.statusCounts),
    [deferredAnalytics.statusCounts],
  );

  const chainMeta = useMemo(
    () =>
      CHAINS.reduce<Record<string, { id: string; name: string; color: string }>>(
        (acc, chain) => {
          acc[chain.id] = chain;
          return acc;
        },
        {},
      ),
    [],
  );

  const [dimension, setDimension] = useState<ShareDimension>("srcChain");
  const [normalized, setNormalized] = useState(false);
  const shareSeries = useMemo(() => computeShareSeries(filteredIntents, dimension), [filteredIntents, dimension]);
  const concentration = useMemo(() => computeConcentration(filteredIntents, dimension), [filteredIntents, dimension]);
  const topMovers = useMemo(() => computeTopMovers(filteredIntents, dimension), [filteredIntents, dimension]);

  const handleCsvExport = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const csv = buildAnalyticsCsvBundle(
      analytics,
      {
        title: "Vortex Protocol Analytics",
        range: analytics.datasetSince
          ? `${analytics.datasetSince} – ${today}`
          : today,
        generatedAt: new Date().toISOString(),
        network: "mainnet",
        dataCompletenessNote: analytics.isCapped
          ? `Partial dataset: latest ${analytics.datasetSize} intents only`
          : "Full dataset loaded",
      },
      { concentration, topMovers },
    );
    downloadCsv(`vortex-analytics-${today}.csv`, csv);
  }, [analytics, concentration, topMovers]);

  const handlePngExport = useCallback(
    async (theme: "light" | "dark") => {
      const svgEl = chartRef.current?.querySelector("svg");
      if (!svgEl) {
        secureLogger.warn("PNG export: no SVG element found in chart container");
        return;
      }
      try {
        const bg = theme === "light" ? "#ffffff" : "#0f1117";
        const blob = await svgToPng(svgEl as SVGSVGElement, { background: bg });
        const today = new Date().toISOString().slice(0, 10);
        downloadBlob(blob, `vortex-analytics-${today}.png`);
      } catch (err) {
        secureLogger.error("PNG export failed", err);
      }
    },
    [],
  );

  const handleCopyLink = useCallback(() => {
    const state: AnalyticsShareState = {};
    if (selectedChain) state.chain = selectedChain;
    if (selectedToken) state.token = selectedToken;
    if (dateFrom) state.from = dateFrom;
    if (dateTo) state.to = dateTo;
    const url = buildShareUrl(state);
    navigator.clipboard.writeText(url).catch((err) => {
      secureLogger.error("Failed to copy shareable link", err);
    });
  }, [selectedChain, selectedToken, dateFrom, dateTo]);

  if (isLoading && intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">{t("analytics.loading")}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">{t("analytics.error")}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8">
            <div className="eyebrow mb-3">{t("analytics.eyebrow")}</div>
            <h1 className="text-3xl font-bold text-vx-text">{t("analytics.empty.title")}</h1>
            <p className="mt-3 max-w-xl text-sm text-vx-muted">{t("analytics.empty.message")}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("nav.analytics")} />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-3">{t("analytics.eyebrow")}</div>
            <h1 className="text-3xl font-bold text-vx-text">{t("analytics.title")}</h1>
            <p className="mt-2 text-sm text-vx-muted">{t("analytics.subtitle")}</p>
          </div>
          <div className="rounded-lg border border-vx-border bg-vx-surface/60 px-3 py-2 text-xs text-vx-muted">
            {t("analytics.window")}
          </div>
          <ExportMenu
            onCsv={handleCsvExport}
            onPng={handlePngExport}
            onCopyLink={handleCopyLink}
          />
        </div>

        {/* Active Shared Filters Banner (#601) */}
        {(selectedChain || selectedToken || dateFrom || dateTo) && (
          <div
            className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-vx-accent/30 bg-vx-accent/10 px-4 py-2.5 text-xs text-vx-text"
            data-testid="active-filters-bar"
            role="status"
          >
            <span className="font-semibold text-vx-accent">Active shared filters:</span>
            {selectedChain && (
              <span className="rounded bg-vx-surface px-2 py-0.5 border border-vx-border" data-testid="filter-badge-chain">
                Chain: {chainMeta[selectedChain]?.name ?? selectedChain}
              </span>
            )}
            {selectedToken && (
              <span className="rounded bg-vx-surface px-2 py-0.5 border border-vx-border" data-testid="filter-badge-token">
                Token: {selectedToken}
              </span>
            )}
            {dateFrom && (
              <span className="rounded bg-vx-surface px-2 py-0.5 border border-vx-border" data-testid="filter-badge-from">
                From: {new Date(dateFrom).toLocaleDateString("en-US")}
              </span>
            )}
            {dateTo && (
              <span className="rounded bg-vx-surface px-2 py-0.5 border border-vx-border" data-testid="filter-badge-to">
                To: {new Date(dateTo).toLocaleDateString("en-US")}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedChain(null);
                setSelectedToken(null);
                setDateFrom(null);
                setDateTo(null);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete(SHARE_PARAM);
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className="ml-auto underline text-vx-dim hover:text-vx-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
              data-testid="clear-shared-filters-btn"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Data-quality banner (issue #467) */}
        <div className="mb-6">
          <DataQualityBanner
            isCapped={analytics.isCapped}
            datasetSize={analytics.datasetSize}
            datasetSince={analytics.datasetSince}
          />
        </div>

        {/* KPI cards with deltas + sparklines (issue #467) */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCardComponent
            label="Total Volume"
            tooltip="Cumulative USD volume of all loaded intents."
            card={analytics.kpis.totalVolume}
          />
          <KpiCardComponent
            label="Rolling 7d"
            tooltip="USD volume in the last 7 days."
            card={analytics.kpis.rollingVolume}
          />
          <KpiCardComponent
            label="Intents"
            tooltip="Total number of intents in this dataset."
            card={analytics.kpis.intentCount}
          />
          <KpiCardComponent
            label="Avg. Intent"
            tooltip="Average USD value per intent."
            card={analytics.kpis.averageSize}
          />
        </div>

        {/* Volume chart + status breakdown */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="card p-5" ref={chartRef}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">{t("analytics.volume.eyebrow")}</div>
                <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.volume.title")}</h2>
              </div>
            </div>
            <LineChart points={analytics.volumeOverTime} />
          </div>

          <div className="card p-5">
            <div className="eyebrow">{t("analytics.status.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.status.title")}</h2>
            <div className="mt-4">
              <StatusBreakdown counts={statusEntries} />
            </div>
          </div>
        </div>

        {/* Chain & token breakdowns */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="eyebrow">{t("analytics.chains.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.chains.title")}</h2>
            <div className="mt-4">
              <BarList
                items={analytics.chainBreakdown}
                formatLabel={(value) => chainMeta[value]?.name ?? value}
                total={analytics.totalVolumeUsd}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow">{t("analytics.tokens.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.tokens.title")}</h2>
            <div className="mt-4">
              <BarList
                items={analytics.destinationTokenBreakdown}
                total={analytics.totalVolumeUsd}
              />
            </div>
          </div>
        </div>

        {/* Route flow visualization (issue #464) */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">Route flow</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">
            Chain → destination token flow
          </h2>
          <p className="mt-1 text-xs text-vx-muted">
            Click any cell to explore those intents. Use the threshold slider to group
            small routes into &quot;Other&quot;.
          </p>
          <div className="mt-4">
            <RouteFlowPanel sankeyData={analytics.sankeyData} chainMeta={chainMeta} />
          </div>
        </div>

        {/* Legacy top-routes table */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">{t("analytics.routes.eyebrow")}</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.routes.title")}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-vx-muted uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="pb-3 pr-4">{t("analytics.routes.route")}</th>
                  <th className="pb-3 pr-4">{t("analytics.routes.volume")}</th>
                  <th className="pb-3 pr-4">{t("analytics.routes.intents")}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.routeBreakdown.map((route) => (
                  <tr
                    key={`${route.sourceChain}-${route.destinationToken}`}
                    className="border-t border-vx-border/80 text-vx-text"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: route.color }}
                        />
                        <span>
                          {chainMeta[route.sourceChain]?.name ?? route.sourceChain} →{" "}
                          {route.destinationToken}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 num">{formatUsd(route.value)}</td>
                    <td className="py-3 pr-4 num">{route.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Issue #468: Market-share trends ────────────────────────────── */}
        <div className="mt-8 card p-5">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="eyebrow">Market share trends</div>
              <h2 className="mt-2 text-lg font-semibold text-vx-text">Share over time</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dimension selector */}
              {(["srcChain", "dstToken", "solver"] as ShareDimension[]).map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setDimension(dim)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    dimension === dim
                      ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                      : "bg-vx-surface/50 text-vx-muted border border-vx-border hover:text-vx-text"
                  }`}
                  aria-pressed={dimension === dim}
                >
                  {dim === "srcChain" ? "Source Chain" : dim === "dstToken" ? "Dest Token" : "Solver"}
                </button>
              ))}
              {/* Normalise toggle */}
              <button
                type="button"
                onClick={() => setNormalized((v) => !v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  normalized
                    ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                    : "bg-vx-surface/50 text-vx-muted border border-vx-border hover:text-vx-text"
                }`}
                aria-pressed={normalized}
              >
                100% normalised
              </button>
            </div>
          </div>
          <StackedAreaChart
            seriesData={shareSeries.series}
            entities={shareSeries.entities}
            colors={shareSeries.colors}
            normalized={normalized}
          />
        </div>

        {/* ── Issue #468: Top movers + Concentration ──────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="eyebrow">Top movers (7d vs previous 7d)</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">Largest share shifts</h2>
            <div className="mt-4">
              <TopMoversPanel movers={topMovers} />
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow">Solver concentration</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">HHI & top-1/top-3 share</h2>
            <div className="mt-4">
              <ConcentrationIndicator result={concentration} />
            </div>
          </div>
        </div>

        {/* Fill-time / SLA panel (issue #465) */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">Fill-time &amp; SLA</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">
            Fill-time distribution &amp; success-rate SLA
          </h2>
          <p className="mt-1 text-xs text-vx-muted">
            How fast and reliably intents are filled.
          </p>
          <div className="mt-4">
            <SlaPanel data={analytics.slaPanel} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
