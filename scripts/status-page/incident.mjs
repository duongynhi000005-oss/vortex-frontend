#!/usr/bin/env node
/**
 * Opens, updates, or closes the single `incident` issue for the staging
 * synthetic, so repeated failures every 15 minutes produce one issue, not one
 * per run.
 *
 * Actions (decideIncidentAction):
 *   open    - failing and no open incident: create the issue (notify)
 *   update  - failing and an incident is open: refresh its body only (no notify)
 *   close   - passing and an incident is open: comment and close (notify)
 *   none    - passing and no open incident
 *
 * The chosen action is written to $GITHUB_OUTPUT as `action` so the workflow can
 * decide whether to send a chat webhook (only on open and close).
 *
 * Usage (GH_TOKEN and GITHUB_REPOSITORY set by Actions):
 *   node scripts/status-page/incident.mjs --run ./run.json
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const INCIDENT_LABEL = 'incident';
export const INCIDENT_TITLE = 'Synthetic staging check failing';
const MARKER = '<!-- synthetic-incident -->';

/** Pure dedupe decision. `openIssue` is the open incident with the exact title, or null. */
export function decideIncidentAction({ status, openIssue }) {
  if (status === 'fail') return openIssue ? 'update' : 'open';
  return openIssue ? 'close' : 'none';
}

/** Failing check ids, or a runner-level message if the run record has none. */
export function failingChecks(run) {
  return run.checks.filter((c) => c.status === 'fail').map((c) => c.id);
}

export function buildIssueBody(run) {
  const failing = failingChecks(run);
  const lines = [
    MARKER,
    `Staging synthetic is failing as of \`${run.timestamp}\`.`,
    '',
    `**Failing checks:** ${failing.length ? failing.map((id) => `\`${id}\``).join(', ') : 'none'}`,
    '',
    '| Check | Result | Duration | Retries |',
    '| --- | --- | --- | --- |',
    ...run.checks.map((c) => `| \`${c.id}\` | ${c.status} | ${c.durationMs} ms | ${c.retries} |`),
    '',
    run.runUrl ? `Logs and traces: ${run.runUrl}` : 'Logs and traces: see the scheduled workflow run.',
    '',
    'The issue closes automatically on the next passing run. Runbook: `docs/synthetic-monitoring.md`.',
  ];
  return lines.join('\n');
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

function findOpenIncident(repo) {
  const raw = gh(['issue', 'list', '--repo', repo, '--state', 'open', '--label', INCIDENT_LABEL, '--json', 'number,title', '--limit', '50']);
  return JSON.parse(raw || '[]').find((issue) => issue.title === INCIDENT_TITLE) ?? null;
}

function main() {
  const runIndex = process.argv.indexOf('--run');
  const repo = process.env['GITHUB_REPOSITORY'];
  if (runIndex === -1 || !process.argv[runIndex + 1] || !repo) {
    console.error('Usage: incident.mjs --run <run.json> (requires GITHUB_REPOSITORY and GH_TOKEN)');
    process.exit(2);
  }

  const run = JSON.parse(readFileSync(process.argv[runIndex + 1], 'utf8'));
  const openIssue = findOpenIncident(repo);
  const action = decideIncidentAction({ status: run.status, openIssue });
  const body = buildIssueBody(run);

  if (action === 'open') {
    // Idempotent: creates the label if it is missing, no-op if it exists.
    gh(['label', 'create', INCIDENT_LABEL, '--repo', repo, '--color', 'B60205', '--description', 'Staging synthetic failure', '--force']);
    gh(['issue', 'create', '--repo', repo, '--title', INCIDENT_TITLE, '--label', INCIDENT_LABEL, '--body-file', '-'], body);
  } else if (action === 'update') {
    gh(['issue', 'edit', String(openIssue.number), '--repo', repo, '--body-file', '-'], body);
  } else if (action === 'close') {
    gh(['issue', 'comment', String(openIssue.number), '--repo', repo, '--body', `Recovered: run ${run.runUrl ?? run.runId ?? ''} passed all checks at \`${run.timestamp}\`.`]);
    gh(['issue', 'close', String(openIssue.number), '--repo', repo, '--reason', 'completed']);
  }

  if (process.env['GITHUB_OUTPUT']) {
    appendFileSync(process.env['GITHUB_OUTPUT'], `action=${action}\n`);
  }
  console.log(`Incident action: ${action}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
