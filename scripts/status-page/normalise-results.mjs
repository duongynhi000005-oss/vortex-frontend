#!/usr/bin/env node
/**
 * Normalises a Playwright JSON report from the staging synthetic into the run
 * record consumed by build-status-page.mjs and incident.mjs.
 *
 * Run record (schemaVersion 1):
 *   { schemaVersion, runId, runUrl, timestamp, status: "pass" | "fail",
 *     checks: [{ id, status: "pass" | "fail", durationMs, retries }] }
 *
 * A check passes when its final attempt passed, so a run that needed the single
 * configured retry is still a pass (it is counted in `retries`).
 *
 * Usage:
 *   node scripts/status-page/normalise-results.mjs \
 *     --report ./synthetic-results/results.json --out ./run.json
 *
 * A missing or unparsable report is recorded as a failed run rather than
 * silently dropped, so a broken runner still alerts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;

/** Collects every spec in a Playwright JSON suite tree. */
function collectSpecs(suite, acc = []) {
  for (const spec of suite.specs ?? []) acc.push(spec);
  for (const child of suite.suites ?? []) collectSpecs(child, acc);
  return acc;
}

/**
 * @param {object | null} report parsed Playwright JSON report, or null if unreadable
 * @param {{ runId?: string | null, runUrl?: string | null, now?: Date }} meta
 */
export function normaliseReport(report, meta = {}) {
  const timestamp = (meta.now ?? new Date()).toISOString();
  const base = {
    schemaVersion: SCHEMA_VERSION,
    runId: meta.runId ?? null,
    runUrl: meta.runUrl ?? null,
    timestamp,
  };

  if (!report || !Array.isArray(report.suites)) {
    return {
      ...base,
      status: 'fail',
      checks: [{ id: 'runner', status: 'fail', durationMs: 0, retries: 0 }],
    };
  }

  const checks = [];
  for (const spec of report.suites.flatMap((suite) => collectSpecs(suite))) {
    const test = spec.tests?.[0];
    const results = test?.results ?? [];
    const final = results.at(-1);
    checks.push({
      id: spec.title,
      status: final?.status === 'passed' ? 'pass' : 'fail',
      durationMs: Math.round(final?.duration ?? 0),
      retries: Math.max(0, results.length - 1),
    });
  }

  if (checks.length === 0) {
    checks.push({ id: 'runner', status: 'fail', durationMs: 0, retries: 0 });
  }

  const status = checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
  return { ...base, status, checks };
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
  if (!args.report || !args.out) {
    console.error('Usage: normalise-results.mjs --report <results.json> --out <run.json>');
    process.exit(2);
  }

  let report = null;
  if (existsSync(args.report)) {
    try {
      report = JSON.parse(readFileSync(args.report, 'utf8'));
    } catch (err) {
      console.error(`Could not parse ${args.report}: ${err.message}`);
    }
  } else {
    console.error(`Report not found at ${args.report}`);
  }

  const run = normaliseReport(report, {
    runId: process.env['GITHUB_RUN_ID'] ?? null,
    runUrl: process.env['GITHUB_SERVER_URL'] && process.env['GITHUB_REPOSITORY'] && process.env['GITHUB_RUN_ID']
      ? `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}/actions/runs/${process.env['GITHUB_RUN_ID']}`
      : null,
  });

  writeFileSync(args.out, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`Run ${run.status}: ${run.checks.filter((c) => c.status === 'pass').length}/${run.checks.length} checks passed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
