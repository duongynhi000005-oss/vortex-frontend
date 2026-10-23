/**
 * Analytics snapshot export utilities.
 * Builds CSV bundles (KPIs, volume series, routes, SLA, concentration, top-movers) with safe CSV escaping.
 * Shareable URL encoding/decoding for analytics range/filter state.
 */

import { escapeCsv } from "@/lib/csv";
import { looksLikeSensitiveBlob } from "@/lib/secureLogging";
import { isValidStrKey } from "@/lib/stellarAddress";
import {
  SLA_THRESHOLDS,
  type AnalyticsSummary,
  type AnalyticsVolumePoint,
  type AnalyticsRouteEntry,
  type SlaPanelData,
  type ConcentrationResult,
  type TopMover,
} from "@/lib/analytics";

// ─── CSV export ────────────────────────────────────────────────────────────────

export type ExportMeta = {
  title: string;
  range: string;
  generatedAt: string;
  network: string;
  dataCompletenessNote: string;
};

export interface AnalyticsExportSections {
  concentration?: ConcentrationResult;
  topMovers?: TopMover[];
}

export function buildMetaRows(meta: ExportMeta): string {
  const lines = [
    `# ${escapeCsv(meta.title)}`,
    `# Range: ${escapeCsv(meta.range)}`,
    `# Generated: ${escapeCsv(meta.generatedAt)}`,
    `# Network: ${escapeCsv(meta.network)}`,
    `# Note: ${escapeCsv(meta.dataCompletenessNote)}`,
    "",
  ];
  return lines.join("\n");
}

export function volumeSeriesCsv(points: AnalyticsVolumePoint[]): string {
  const header = "date,totalVolumeUsd";
  const rows = points.map(
    (p) => `${escapeCsv(p.date)},${escapeCsv(p.totalVolumeUsd.toFixed(2))}`,
  );
  return [header, ...rows].join("\n");
}

export function routesCsv(routes: AnalyticsRouteEntry[]): string {
  const header = "sourceChain,destinationToken,volumeUsd,intentCount,sharePercent";
  const totalVol = routes.reduce((s, r) => s + r.value, 0);
  const rows = routes.map((r) =>
    [
      escapeCsv(r.sourceChain),
      escapeCsv(r.destinationToken),
      escapeCsv(r.value.toFixed(2)),
      escapeCsv(String(r.count)),
      escapeCsv(totalVol > 0 ? ((r.value / totalVol) * 100).toFixed(2) : "0.00"),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function kpisCsv(summary: AnalyticsSummary): string {
  const header = "metric,value";
  const rows = [
    `totalVolumeUsd,${summary.totalVolumeUsd.toFixed(2)}`,
    `rollingVolume7dUsd,${summary.rollingVolumeUsd.toFixed(2)}`,
    `averageIntentSizeUsd,${summary.averageVolumeUsd.toFixed(2)}`,
    `totalIntents,${summary.totalIntents}`,
    `filledIntents,${summary.statusCounts.filled}`,
    `failedIntents,${summary.statusCounts.failed}`,
    `pendingIntents,${summary.statusCounts.pending}`,
  ];
  return [header, ...rows].join("\n");
}

/**
 * Build CSV section for fill-time SLA metrics (#602).
 */
export function slaCsv(sla?: SlaPanelData): string {
  const header = "percentile,targetThresholdSeconds,actualSeconds,status";
  if (!sla || sla.filledCount === 0) {
    return [
      header,
      `p50,${SLA_THRESHOLDS.p50MaxSeconds},0.00,NO_DATA`,
      `p90,${SLA_THRESHOLDS.p90MaxSeconds},0.00,NO_DATA`,
      `p99,${SLA_THRESHOLDS.p99MaxSeconds},0.00,NO_DATA`,
      "",
      "metric,count",
      "filledIntentsAnalyzed,0",
      `pendingIntentsExcluded,${escapeCsv(String(sla?.pendingCount ?? 0))}`,
      `clampedIntents,${escapeCsv(String(sla?.clampedCount ?? 0))}`,
    ].join("\n");
  }

  const rows = [
    `p50,${SLA_THRESHOLDS.p50MaxSeconds},${escapeCsv(sla.percentiles.p50.toFixed(2))},${sla.sla.p50 ? "PASS" : "FAIL"}`,
    `p90,${SLA_THRESHOLDS.p90MaxSeconds},${escapeCsv(sla.percentiles.p90.toFixed(2))},${sla.sla.p90 ? "PASS" : "FAIL"}`,
    `p99,${SLA_THRESHOLDS.p99MaxSeconds},${escapeCsv(sla.percentiles.p99.toFixed(2))},${sla.sla.p99 ? "PASS" : "FAIL"}`,
    "",
    "metric,count",
    `filledIntentsAnalyzed,${escapeCsv(String(sla.filledCount))}`,
    `pendingIntentsExcluded,${escapeCsv(String(sla.pendingCount))}`,
    `clampedIntents,${escapeCsv(String(sla.clampedCount))}`,
  ];

  return [header, ...rows].join("\n");
}

/**
 * Build CSV section for market concentration / HHI index (#602).
 */
export function concentrationCsv(concentration?: ConcentrationResult): string {
  const header = "metric,value";
  if (!concentration) {
    return [
      header,
      "hhiIndex,0",
      "top1SharePercent,0.00",
      "top3SharePercent,0.00",
      "concentrationLevel,competitive",
    ].join("\n");
  }

  const summaryRows = [
    `hhiIndex,${escapeCsv(String(concentration.hhi))}`,
    `top1SharePercent,${escapeCsv(concentration.top1SharePct.toFixed(2))}`,
    `top3SharePercent,${escapeCsv(concentration.top3SharePct.toFixed(2))}`,
    `concentrationLevel,${escapeCsv(concentration.level)}`,
  ];

  const entityHeader = "entity,sharePercent";
  const entityRows = (concentration.entities || []).map(
    (e) => `${escapeCsv(e.label)},${escapeCsv(e.sharePct.toFixed(2))}`,
  );

  return [header, ...summaryRows, "", entityHeader, ...entityRows].join("\n");
}

/**
 * Build CSV section for top movers / share velocity (#602).
 */
export function topMoversCsv(topMovers?: TopMover[]): string {
  const header = "entity,currentSharePercent,previousSharePercent,deltaSharePercent";
  if (!topMovers || topMovers.length === 0) {
    return header;
  }

  const rows = topMovers.map((m) => {
    const deltaSign = m.deltaSharePct > 0 ? "+" : "";
    return [
      escapeCsv(m.label),
      escapeCsv(m.currentSharePct.toFixed(2)),
      escapeCsv(m.previousSharePct.toFixed(2)),
      escapeCsv(`${deltaSign}${m.deltaSharePct.toFixed(2)}`),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Build a multi-section CSV bundle for analytics export (#602).
 * Sections are separated by blank lines with section headers.
 * Backward compatibility: original sections (KPIs, Volume Series, Routes)
 * retain identical order and formats.
 */
export function buildAnalyticsCsvBundle(
  summary: AnalyticsSummary,
  meta: ExportMeta,
  extra?: AnalyticsExportSections,
): string {
  const concentration = extra?.concentration ?? (summary as any).concentration;
  const topMovers = extra?.topMovers ?? (summary as any).topMovers;

  const sections = [
    buildMetaRows(meta),
    "## KPIs\n" + kpisCsv(summary),
    "",
    "## Volume Series\n" + volumeSeriesCsv(summary.volumeOverTime),
    "",
    "## Routes\n" + routesCsv(summary.routeBreakdown),
    "",
    "## SLA Performance\n" + slaCsv(summary.slaPanel),
    "",
    "## Market Concentration\n" + concentrationCsv(concentration),
    "",
    "## Top Movers\n" + topMoversCsv(topMovers),
  ];
  return sections.join("\n");
}

// ─── Shareable URL state ──────────────────────────────────────────────────────

/**
 * Audit (#648): the CSV bundle holds only aggregates (KPI totals, daily volume,
 * source-chain/destination-token route totals) — no addresses, XDR or
 * signatures. Share state is filter/view state only. Every value is bounded and
 * must not look like a Stellar address or XDR blob, enforced on decode.
 */
export type AnalyticsShareState = {
  /** Date range start ISO string */
  from?: string;
  /** Date range end ISO string */
  to?: string;
  /** Selected chain filter */
  chain?: string;
  /** Selected token filter */
  token?: string;
};

const SHARE_PARAM = "av"; // analytics-view — short to keep URLs tidy
const MAX_SHARE_PARAM_LENGTH = 1024;
const MAX_SHARE_VALUE_LENGTH = 64;

/** True when a share-state value is bounded and carries no address/XDR-shaped data. */
function isSafeShareValue(v: string): boolean {
  return (
    v.length <= MAX_SHARE_VALUE_LENGTH &&
    !isValidStrKey(v) &&
    !looksLikeSensitiveBlob(v)
  );
}

/**
 * Encode analytics filter state into a URL search-param string.
 * Only encodes range/filter data — never wallet or personal data.
 */
export function encodeShareState(state: AnalyticsShareState): string {
  const compact: Record<string, string> = {};
  if (state.from && isSafeShareValue(state.from)) compact.f = state.from;
  if (state.to && isSafeShareValue(state.to)) compact.t = state.to;
  if (state.chain && isSafeShareValue(state.chain)) compact.c = state.chain;
  if (state.token && isSafeShareValue(state.token)) compact.tk = state.token;
  return btoa(JSON.stringify(compact));
}

/**
 * Decode analytics filter state from a URL search-param value.
 * Returns null if the param is missing, malformed, or contains unexpected keys.
 */
export function decodeShareState(raw: string | null): AnalyticsShareState | null {
  if (!raw || raw.length > MAX_SHARE_PARAM_LENGTH) return null;
  try {
    const decoded = JSON.parse(atob(raw)) as Record<string, unknown>;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    const ALLOWED_KEYS = new Set(["f", "t", "c", "tk"]);
    // Validate — reject if any unexpected key is present
    for (const key of Object.keys(decoded)) {
      if (!ALLOWED_KEYS.has(key)) return null;
    }
    const state: AnalyticsShareState = {};
    if (typeof decoded.f === "string" && isSafeShareValue(decoded.f)) state.from = decoded.f;
    if (typeof decoded.t === "string" && isSafeShareValue(decoded.t)) state.to = decoded.t;
    if (typeof decoded.c === "string" && isSafeShareValue(decoded.c)) state.chain = decoded.c;
    if (typeof decoded.tk === "string" && isSafeShareValue(decoded.tk)) state.token = decoded.tk;
    return state;
  } catch {
    return null;
  }
}

/**
 * Build a full shareable URL for the analytics page.
 * Reads current pathname from window.location.
 */
export function buildShareUrl(state: AnalyticsShareState): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_PARAM, encodeShareState(state));
  return url.toString();
}

/**
 * Read share state from the current URL (client-side only).
 * Returns null when not in a browser context or param is absent/invalid.
 */
export function readShareStateFromUrl(): AnalyticsShareState | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return decodeShareState(params.get(SHARE_PARAM));
}

export { SHARE_PARAM };
