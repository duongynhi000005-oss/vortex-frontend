# Staging synthetic monitoring

A scheduled Playwright run exercises the user path on staging every 15 minutes:
page load without console errors, relay `/health`, the live feed region, the
WebSocket, and a canned quote request. It is independent of the PR e2e suites
and never connects a wallet, signs, or submits.

- Workflow: `.github/workflows/uptime-check.yml`
- Suite: `e2e/synthetic/staging-flow.spec.ts` (config: `e2e/synthetic/playwright.config.ts`)
- Scripts: `scripts/status-page/`
  - `normalise-results.mjs` turns Playwright's JSON report into a run record (`schemaVersion: 1`).
  - `build-status-page.mjs` appends the run to `data/history.json` and rebuilds `index.html`.
  - `incident.mjs` opens, updates, or closes the single `incident` issue.

## Checks

| Check id | Pass condition | Budget |
| --- | --- | --- |
| `page-load` | `/` returns < 400 and no console or page errors | 60 s |
| `relay-health` | `GET {API}/health` returns < 400 | 60 s |
| `feed` | `#live-feed-region` shows items or an empty state | 60 s |
| `websocket-open` | A WebSocket is created and receives a frame | `SYNTHETIC_WS_BUDGET_MS` (10 s) |
| `quote` | `GET {API}{SYNTHETIC_QUOTE_PATH}` returns 200 within budget | `SYNTHETIC_QUOTE_BUDGET_MS` (5 s) |

Check ids are the history keys. Renaming one starts a new series on the status page.

Each check gets one retry (`retries: 1`). A check passes if its final attempt passed, and the
retry count is recorded. A run passes only if every check passes.

## Alerting

- **Incident issue:** one open issue titled `Synthetic staging check failing`, labelled `incident`.
  - First failure: opens it and sends the chat webhook.
  - Later failures: refreshes the issue body in place, with no comment and no notification.
  - First pass after a failure: comments, closes it, and sends the webhook.
  - Issues are deduplicated by exact title among open `incident` issues.
- **Chat webhook (optional):** set the `SYNTHETIC_WEBHOOK_URL` secret. The payload contains both `text` (Slack-compatible) and `content` (Discord). Unset means no notification, and the incident issue still works.
- **Red run:** the report job ends red when the run failed, so the Actions tab shows it too.
- Paging and on-call rotation are out of scope.

## Status page

Results accumulate on the `gh-pages` branch in `data/history.json` (30-day window, pruned on
each run). `index.html` shows uptime over the window, p50/p95 latency per check, and a 24-hour strip.

One-time setup:

1. Create an orphan `gh-pages` branch with an empty commit, then push it.
2. Settings → Pages → Source: "Deploy from a branch", branch `gh-pages`, folder `/ (root)`.
3. The page URL is `https://stellar-vortex-protocol.github.io/vortex-frontend/`.

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `SYNTHETIC_BASE_URL` | variable | Staging frontend URL (default: `https://vortex-frontend.vercel.app`) |
| `SYNTHETIC_API_URL` | variable | Staging relay URL (default: `https://api.vortex-protocol.org`) |
| `SYNTHETIC_QUOTE_PATH` | env in the suite | Canned quote route, including its query string |
| `SYNTHETIC_WS_BUDGET_MS`, `SYNTHETIC_QUOTE_BUDGET_MS` | variable | Latency budgets |
| `SYNTHETIC_MAINTENANCE` | variable | Set to `true` to skip the probe during planned staging downtime |
| `SYNTHETIC_WEBHOOK_URL` | secret | Optional Slack or Discord webhook |

Forks have no secrets, so the webhook step is skipped there. Scheduled runs only execute on the default branch.

## Demo a failure

Run **Actions → Staging Synthetic Check → Run workflow** and set `force_failure` to `true`.
This sets the quote budget to 1 ms, so the `quote` check fails and opens the incident.
Dispatch again without the flag to watch it close.

## Cost and time limits

- Cadence: 96 runs per day, about 2,900 per 30 days.
- Each run takes roughly 4–6 minutes: `npm install` of the full dev dependency tree, Chromium
  install, then the suite. The job's timeout is 20 minutes, and the report job's is 10.
- On a **private** repository this bills about 12,000–17,000 Actions minutes per month. Public repositories use standard runners at no charge.
- To cut cost, cache `~/.cache/ms-playwright` and install only `@playwright/test`. Neither is done yet.
- Artifacts are kept for 14 days.

## Known limits

- GitHub may delay scheduled runs under load, and it disables scheduled workflows in public repositories after 60 days without repository activity. If the status page stops advancing, check the Actions tab and re-enable the workflow.
- `websocket-open` requires at least one frame within the budget. A quiet staging feed will fail it, so keep staging traffic flowing or relax the check.
- The `quote` request uses a placeholder route until it is verified against the relay's current contract. Set `SYNTHETIC_QUOTE_PATH` to match.
- The UI "Live" control is a pause toggle, not a connection indicator, so the WebSocket check observes the socket directly.
