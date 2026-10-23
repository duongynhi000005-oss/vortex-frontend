#!/usr/bin/env node
/**
 * Appends one normalised run to the synthetic history and regenerates the
 * static status page (uptime and latency over the last 30 days).
 *
 * The output directory is the gh-pages checkout: it holds data/history.json
 * (the append-only source of truth) and index.html (rebuilt on every run).
 *
 * Usage:
 *   node scripts/status-page/build-status-page.mjs --run ./run.json --out ./pages
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RUNS = 96; // 24h at the 15-minute cadence

/** Drops runs older than the window and ignores a run id already recorded. */
export function appendRun(history, run, now = new Date()) {
  const cutoff = now.getTime() - WINDOW_DAYS * DAY_MS;
  const existing = (history.runs ?? []).filter(
    (r) => Date.parse(r.timestamp) >= cutoff && (!run.runId || r.runId !== run.runId),
  );
  return { schemaVersion: run.schemaVersion, runs: [...existing, run].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) };
}

/** Nearest-rank percentile over an ascending-sorted array. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

const pct = (part, whole) => (whole === 0 ? null : Math.round((part / whole) * 10000) / 100);

/** Aggregates the window into overall uptime plus per-check uptime and latency. */
export function summarise(history, now = new Date()) {
  const cutoff = now.getTime() - WINDOW_DAYS * DAY_MS;
  const runs = (history.runs ?? []).filter((r) => Date.parse(r.timestamp) >= cutoff);
  const passing = runs.filter((r) => r.status === 'pass').length;

  const byCheck = new Map();
  for (const run of runs) {
    for (const check of run.checks) {
      const entry = byCheck.get(check.id) ?? { total: 0, passed: 0, durations: [] };
      entry.total += 1;
      if (check.status === 'pass') {
        entry.passed += 1;
        entry.durations.push(check.durationMs);
      }
      byCheck.set(check.id, entry);
    }
  }

  const checks = [...byCheck.entries()].map(([id, entry]) => {
    const sorted = [...entry.durations].sort((a, b) => a - b);
    return {
      id,
      uptimePct: pct(entry.passed, entry.total),
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      samples: entry.total,
    };
  });

  return {
    generatedAt: now.toISOString(),
    windowDays: WINDOW_DAYS,
    uptimePct: pct(passing, runs.length),
    runCount: runs.length,
    lastRun: runs.at(-1) ?? null,
    recent: runs.slice(-RECENT_RUNS),
    checks,
  };
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const fmtPct = (value) => (value === null ? 'n/a' : `${value.toFixed(2)}%`);
const fmtMs = (value) => (value === null ? 'n/a' : `${value} ms`);

/** Renders the summary as one self-contained HTML file (no external assets). */
export function renderHtml(summary) {
  const last = summary.lastRun;
  const bars = summary.recent
    .map((r) => {
      const label = `${r.timestamp} — ${r.status}`;
      return `<span class="bar ${r.status}" title="${escapeHtml(label)}"></span>`;
    })
    .join('');
  const rows = summary.checks
    .map(
      (c) => `<tr><td>${escapeHtml(c.id)}</td><td>${fmtPct(c.uptimePct)}</td><td>${fmtMs(c.p50Ms)}</td><td>${fmtMs(c.p95Ms)}</td><td>${c.samples}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vortex staging status</title>
<style>
  :root { color-scheme: light dark; --bg: #fbfbf8; --fg: #1c1f1c; --muted: #6b716b; --line: #d9ddd6; --ok: #3f8f5a; --bad: #b8473d; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161917; --fg: #e8ebe6; --muted: #98a096; --line: #2e332f; --ok: #5fb37c; --bad: #e0695e; } }
  body { font: 15px/1.5 system-ui, sans-serif; background: var(--bg); color: var(--fg); margin: 0; padding: 2rem 1rem; }
  main { max-width: 52rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .meta, .muted { color: var(--muted); font-size: .9rem; }
  .summary { display: flex; gap: 2rem; margin: 1.5rem 0; flex-wrap: wrap; }
  .summary strong { display: block; font-size: 1.6rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .5rem .25rem; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
  .strip { display: flex; flex-wrap: wrap; gap: 2px; margin-top: .5rem; }
  .bar { width: 6px; height: 18px; border-radius: 2px; background: var(--muted); }
  .bar.pass { background: var(--ok); }
  .bar.fail { background: var(--bad); }
  a:focus-visible { outline: 2px solid var(--ok); outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <h1>Vortex staging status</h1>
  <p class="meta">Last check: ${last ? escapeHtml(last.timestamp) : 'never'} · Generated ${escapeHtml(summary.generatedAt)}</p>
  <section class="summary" aria-label="Summary">
    <div><span class="muted">Last ${summary.windowDays} days uptime</span><strong>${fmtPct(summary.uptimePct)}</strong></div>
    <div><span class="muted">Runs in window</span><strong>${summary.runCount}</strong></div>
    <div><span class="muted">Current status</span><strong>${last ? escapeHtml(last.status) : 'n/a'}</strong></div>
  </section>
  <h2>Checks</h2>
  <table>
    <thead><tr><th scope="col">Check</th><th scope="col">Uptime</th><th scope="col">p50</th><th scope="col">p95</th><th scope="col">Runs</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <h2>Last 24 hours</h2>
  <div class="strip" role="img" aria-label="${summary.recent.length} recent runs">${bars}</div>
  <p class="muted">Synthetic checks run every 15 minutes from GitHub Actions against staging. Runbook: <a href="https://github.com/stellar-vortex-protocol/vortex-frontend/blob/main/docs/synthetic-monitoring.md">docs/synthetic-monitoring.md</a>.</p>
</main>
</body>
</html>
`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run || !args.out) {
    console.error('Usage: build-status-page.mjs --run <run.json> --out <pages-dir>');
    process.exit(2);
  }

  const historyPath = join(args.out, 'data', 'history.json');
  const history = existsSync(historyPath)
    ? JSON.parse(readFileSync(historyPath, 'utf8'))
    : { schemaVersion: 1, runs: [] };
  const run = JSON.parse(readFileSync(args.run, 'utf8'));

  const next = appendRun(history, run);
  const summary = summarise(next);

  mkdirSync(dirname(historyPath), { recursive: true });
  writeFileSync(historyPath, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(join(args.out, 'index.html'), renderHtml(summary));
  console.log(`Recorded ${run.status} run; ${summary.runCount} runs, ${fmtPct(summary.uptimePct)} uptime over ${WINDOW_DAYS} days`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
