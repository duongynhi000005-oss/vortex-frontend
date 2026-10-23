import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  encodeShareState,
  buildAnalyticsCsvBundle,
  slaCsv,
  concentrationCsv,
  topMoversCsv,
  type AnalyticsShareState,
  type ExportMeta,
} from "./analyticsExport";
import type {
  AnalyticsSummary,
  SlaPanelData,
  ConcentrationResult,
  TopMover,
} from "@/lib/analytics";

const STELLAR_PUBLIC_KEY = /G[A-Z2-7]{55}/;
const STELLAR_SECRET_KEY = /S[A-Z2-7]{55}/;
const XDR_PREFIX = /AAAA[A-Za-z0-9+/]{8,}/;

/** True when `s` looks like a Stellar public/secret key or a base64 XDR blob. */
function looksLikeStellarKeyOrXdr(s: string): boolean {
  return (
    STELLAR_PUBLIC_KEY.test(s) ||
    STELLAR_SECRET_KEY.test(s) ||
    XDR_PREFIX.test(s)
  );
}

const FIXTURES: AnalyticsShareState[] = [
  {},
  { from: "2025-01-01T00:00:00.000Z", to: "2025-12-31T23:59:59.999Z" },
  { chain: "stellar", token: "USDC" },
  {
    from: "2025-01-01",
    to: "2025-06-30",
    chain: "ethereum",
    token: "XLM",
  },
];

describe("analytics share URL privacy policy", () => {
  it.each(FIXTURES.map((f) => [JSON.stringify(f), f] as const))(
    "never carries wallet or XDR data: %s",
    (_label, state) => {
      const encoded = encodeShareState(state);
      const decodedJson = atob(encoded);
      const url = buildShareUrl(state);

      for (const [field, value] of Object.entries(JSON.parse(decodedJson))) {
        expect(
          looksLikeStellarKeyOrXdr(String(value)),
          `share-state field "${field}" looks like a Stellar key or XDR`,
        ).toBe(false);
      }
      expect(looksLikeStellarKeyOrXdr(encoded), "encoded share state").toBe(
        false,
      );
      expect(looksLikeStellarKeyOrXdr(decodedJson), "decoded share state").toBe(
        false,
      );
      expect(looksLikeStellarKeyOrXdr(url), "share URL").toBe(false);
    },
  );

  it("the guard detects wallet-shaped values", () => {
    const g = "G" + "A".repeat(55);
    const s = "S" + "B".repeat(55);
    expect(looksLikeStellarKeyOrXdr(g)).toBe(true);
    expect(looksLikeStellarKeyOrXdr(s)).toBe(true);
    expect(looksLikeStellarKeyOrXdr("AAAAAgAAAAC12345678")).toBe(true);
    expect(looksLikeStellarKeyOrXdr("USDC")).toBe(false);
  });
});

describe("Analytics CSV Export Extended Sections (#602)", () => {
  const sampleMeta: ExportMeta = {
    title: "Vortex Protocol Analytics",
    range: "2025-01-01 – 2025-01-07",
    generatedAt: "2025-01-07T12:00:00.000Z",
    network: "mainnet",
    dataCompletenessNote: "Full dataset loaded",
  };

  const sampleSla: SlaPanelData = {
    percentiles: { p50: 15.2, p90: 45.8, p99: 130.5 },
    histogram: [],
    successRateByDay: [],
    successRateMovingAvg: [],
    filledCount: 150,
    pendingCount: 10,
    clampedCount: 2,
    sla: {
      p50: true,
      p90: true,
      p99: false, // 130.5 > 120 threshold -> FAIL
    },
  };

  const sampleConcentration: ConcentrationResult = {
    hhi: 2150,
    top1SharePct: 40.5,
    top3SharePct: 75.2,
    level: "moderate",
    entities: [
      { label: "solver-alpha", sharePct: 40.5 },
      { label: "solver-beta", sharePct: 22.3 },
      { label: "solver-gamma", sharePct: 12.4 },
    ],
  };

  const sampleTopMovers: TopMover[] = [
    {
      label: "solver-alpha",
      currentSharePct: 40.5,
      previousSharePct: 32.0,
      deltaSharePct: 8.5,
      color: "#4CEBA8",
    },
    {
      label: "solver-delta",
      currentSharePct: 10.0,
      previousSharePct: 14.2,
      deltaSharePct: -4.2,
      color: "#F43F5E",
    },
  ];

  const sampleSummary: AnalyticsSummary = {
    totalIntents: 200,
    totalVolumeUsd: 150000.5,
    rollingVolumeUsd: 95000.25,
    averageVolumeUsd: 750.0,
    statusCounts: {
      filled: 150,
      failed: 10,
      pending: 40,
    },
    chainBreakdown: [],
    destinationTokenBreakdown: [],
    routeBreakdown: [
      {
        sourceChain: "ethereum",
        destinationToken: "USDC",
        value: 100000,
        count: 100,
        color: "#627EEA",
      },
    ],
    volumeOverTime: [{ date: "2025-01-01", totalVolumeUsd: 50000 }],
    granularity: "day",
    from: "2025-01-01",
    to: "2025-01-07",
    ignoredRows: 0,
    isCapped: false,
    datasetSize: 200,
    datasetSince: "2025-01-01",
    kpis: {} as any,
    slaPanel: sampleSla,
    sankeyData: {} as any,
  };

  describe("slaCsv", () => {
    it("formats SLA percentiles, targets, actuals, and status correctly", () => {
      const csv = slaCsv(sampleSla);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("percentile,targetThresholdSeconds,actualSeconds,status");
      expect(lines[1]).toBe("p50,30,15.20,PASS");
      expect(lines[2]).toBe("p90,60,45.80,PASS");
      expect(lines[3]).toBe("p99,120,130.50,FAIL");
      expect(lines[5]).toBe("metric,count");
      expect(lines[6]).toBe("filledIntentsAnalyzed,150");
      expect(lines[7]).toBe("pendingIntentsExcluded,10");
      expect(lines[8]).toBe("clampedIntents,2");
    });

    it("handles empty or zero-fill SLA data gracefully", () => {
      const emptySla: SlaPanelData = {
        percentiles: { p50: 0, p90: 0, p99: 0 },
        histogram: [],
        successRateByDay: [],
        successRateMovingAvg: [],
        filledCount: 0,
        pendingCount: 5,
        clampedCount: 0,
        sla: { p50: false, p90: false, p99: false },
      };

      const csv = slaCsv(emptySla);
      expect(csv).toContain("p50,30,0.00,NO_DATA");
      expect(csv).toContain("filledIntentsAnalyzed,0");
      expect(csv).toContain("pendingIntentsExcluded,5");
    });
  });

  describe("concentrationCsv", () => {
    it("formats HHI index, top-1/top-3 shares, level, and entity breakdown", () => {
      const csv = concentrationCsv(sampleConcentration);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("metric,value");
      expect(lines[1]).toBe("hhiIndex,2150");
      expect(lines[2]).toBe("top1SharePercent,40.50");
      expect(lines[3]).toBe("top3SharePercent,75.20");
      expect(lines[4]).toBe("concentrationLevel,moderate");
      expect(lines[6]).toBe("entity,sharePercent");
      expect(lines[7]).toBe("solver-alpha,40.50");
      expect(lines[8]).toBe("solver-beta,22.30");
      expect(lines[9]).toBe("solver-gamma,12.40");
    });

    it("handles undefined concentration gracefully", () => {
      const csv = concentrationCsv(undefined);
      expect(csv).toContain("hhiIndex,0");
      expect(csv).toContain("concentrationLevel,competitive");
    });
  });

  describe("topMoversCsv", () => {
    it("formats top movers with signed deltas and share percentages", () => {
      const csv = topMoversCsv(sampleTopMovers);
      const lines = csv.split("\n");

      expect(lines[0]).toBe(
        "entity,currentSharePercent,previousSharePercent,deltaSharePercent",
      );
      expect(lines[1]).toBe("solver-alpha,40.50,32.00,'+8.50");
      expect(lines[2]).toBe("solver-delta,10.00,14.20,'-4.20");
    });

    it("handles empty top movers list", () => {
      const csv = topMoversCsv([]);
      expect(csv).toBe(
        "entity,currentSharePercent,previousSharePercent,deltaSharePercent",
      );
    });
  });

  describe("buildAnalyticsCsvBundle integration", () => {
    it("includes all 7 sections in backward-compatible sequence", () => {
      const bundle = buildAnalyticsCsvBundle(sampleSummary, sampleMeta, {
        concentration: sampleConcentration,
        topMovers: sampleTopMovers,
      });

      // Section order verification
      const kpisIdx = bundle.indexOf("## KPIs");
      const volumeIdx = bundle.indexOf("## Volume Series");
      const routesIdx = bundle.indexOf("## Routes");
      const slaIdx = bundle.indexOf("## SLA Performance");
      const concIdx = bundle.indexOf("## Market Concentration");
      const moversIdx = bundle.indexOf("## Top Movers");

      expect(kpisIdx).toBeGreaterThan(0);
      expect(volumeIdx).toBeGreaterThan(kpisIdx);
      expect(routesIdx).toBeGreaterThan(volumeIdx);
      expect(slaIdx).toBeGreaterThan(routesIdx);
      expect(concIdx).toBeGreaterThan(slaIdx);
      expect(moversIdx).toBeGreaterThan(concIdx);

      // Verify content presence
      expect(bundle).toContain("totalVolumeUsd,150000.50");
      expect(bundle).toContain("ethereum,USDC,100000.00,100,100.00");
      expect(bundle).toContain("p50,30,15.20,PASS");
      expect(bundle).toContain("p99,120,130.50,FAIL");
      expect(bundle).toContain("hhiIndex,2150");
      expect(bundle).toContain("solver-alpha,40.50,32.00,'+8.50");
    });

    it("works without extra options by gracefully rendering fallback sections", () => {
      const bundle = buildAnalyticsCsvBundle(sampleSummary, sampleMeta);

      expect(bundle).toContain("## SLA Performance");
      expect(bundle).toContain("## Market Concentration");
      expect(bundle).toContain("## Top Movers");
      expect(bundle).toContain("hhiIndex,0");
    });
  });
});
