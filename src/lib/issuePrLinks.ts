/**
 * Server-side resolver that maps completed Wave issue numbers to the merged
 * pull request that closed them, used by `/api/issue-prs`.
 *
 * Mirrors `contributors.ts`: the browser never talks to api.github.com, the
 * payload is validated and normalised, the optional server-only `GITHUB_TOKEN`
 * raises the rate limit, bodies are size-bounded, requests time out, and any
 * failure falls back to the last good link (or no link at all). Issues closed
 * without a PR simply resolve to nothing.
 */

import { CONTRIBUTORS_REVALIDATE_SECONDS, REPO_NAME, REPO_OWNER } from "./contributors";

/** Same cache window as the contributors list. */
export const ISSUE_PR_REVALIDATE_SECONDS = CONTRIBUTORS_REVALIDATE_SECONDS;

/** Maximum issue numbers resolved per request. */
export const MAX_ISSUE_IDS = 50;

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 1024 * 1024;
const CONCURRENCY = 5;

export type IssuePrLinks = Record<number, string>;

export function prUrlFor(prNumber: number): string {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${prNumber}`;
}

/** Parses `?ids=1,2,3` into unique positive integers, capped at MAX_ISSUE_IDS. */
export function parseIssueIds(raw: string | null): number[] {
  if (!raw) return [];
  const ids = new Set<number>();
  for (const part of raw.split(",")) {
    if (!/^\d{1,9}$/.test(part.trim())) continue;
    const n = Number(part);
    if (n > 0) ids.add(n);
    if (ids.size >= MAX_ISSUE_IDS) break;
  }
  return [...ids];
}

/**
 * Picks the closing PR from an untrusted GitHub issue timeline: the most recent
 * cross-reference from a merged pull request in this repository. Returns null
 * when the issue was closed without a PR.
 */
export function extractClosingPr(payload: unknown): number | null {
  if (!Array.isArray(payload)) throw new Error("Malformed timeline payload");
  let found: number | null = null;
  for (const event of payload) {
    if (!event || typeof event !== "object") continue;
    const e = event as Record<string, unknown>;
    if (e["event"] !== "cross-referenced") continue;
    const issue = (e["source"] as { issue?: Record<string, unknown> } | undefined)?.issue;
    if (!issue || typeof issue !== "object") continue;
    const pr = issue["pull_request"] as { merged_at?: unknown } | undefined;
    if (!pr || typeof pr.merged_at !== "string") continue;
    const repo = (issue["repository"] as { full_name?: unknown } | undefined)?.full_name;
    if (repo !== undefined && repo !== `${REPO_OWNER}/${REPO_NAME}`) continue;
    const number = issue["number"];
    if (typeof number === "number" && Number.isInteger(number) && number > 0) found = number;
  }
  return found;
}

const lastGood = new Map<number, string | null>();

/** Test helper. */
export function __resetIssuePrCache(): void {
  lastGood.clear();
}

async function resolveOne(
  id: number,
  fetchImpl: typeof fetch,
  token: string | null,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${REPO_OWNER}-${REPO_NAME}`,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchImpl(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${id}/timeline?per_page=100`,
      {
        headers,
        signal: controller.signal,
        next: { revalidate: ISSUE_PR_REVALIDATE_SECONDS },
      } as RequestInit,
    );
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const body = await res.text();
    if (body.length > MAX_BODY_BYTES) throw new Error("GitHub response too large");

    const pr = extractClosingPr(JSON.parse(body));
    const url = pr === null ? null : prUrlFor(pr);
    lastGood.set(id, url);
    return url;
  } catch {
    // Fail soft: last known link, else no link.
    return lastGood.get(id) ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getIssuePrLinks(
  ids: number[],
  fetchImpl: typeof fetch = fetch,
  token: string | null = process.env["GITHUB_TOKEN"] ?? null,
): Promise<IssuePrLinks> {
  const links: IssuePrLinks = {};
  const queue = ids.slice(0, MAX_ISSUE_IDS);
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const url = await resolveOne(id, fetchImpl, token);
      if (url) links[id] = url;
    }
  });
  await Promise.all(workers);
  return links;
}
