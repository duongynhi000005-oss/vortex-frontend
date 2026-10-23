import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetIssuePrCache,
  extractClosingPr,
  getIssuePrLinks,
  parseIssueIds,
  prUrlFor,
} from "@/lib/issuePrLinks";

const ref = (number: number, merged: boolean, repo = "stellar-vortex-protocol/vortex-frontend") => ({
  event: "cross-referenced",
  source: {
    type: "issue",
    issue: {
      number,
      repository: { full_name: repo },
      pull_request: merged ? { merged_at: "2026-01-01T00:00:00Z" } : { merged_at: null },
    },
  },
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("issue PR links", () => {
  beforeEach(() => __resetIssuePrCache());

  it("parses and bounds issue ids", () => {
    expect(parseIssueIds("3,3,x,-1,0,7")).toEqual([3, 7]);
    expect(parseIssueIds(null)).toEqual([]);
    expect(parseIssueIds(Array.from({ length: 80 }, (_, i) => i + 1).join(",")).length).toBe(50);
  });

  it("picks the merged same-repo PR and ignores others", () => {
    expect(extractClosingPr([ref(5, false), ref(9, true, "evil/repo"), ref(12, true), { event: "labeled" }, null])).toBe(12);
    expect(extractClosingPr([])).toBeNull();
    expect(() => extractClosingPr({})).toThrow();
  });

  it("resolves links, omitting issues closed without a PR", async () => {
    const fetchImpl = (async (url: string) =>
      String(url).includes("/issues/1/") ? response([ref(40, true)]) : response([])) as unknown as typeof fetch;
    expect(await getIssuePrLinks([1, 2], fetchImpl, null)).toEqual({ 1: prUrlFor(40) });
  });

  it("sends the token only when provided", async () => {
    let auth: string | undefined;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>)["Authorization"];
      return response([]);
    }) as unknown as typeof fetch;
    await getIssuePrLinks([1], fetchImpl, null);
    expect(auth).toBeUndefined();
    await getIssuePrLinks([1], fetchImpl, "tok");
    expect(auth).toBe("Bearer tok");
  });

  it("fails soft: last good link, else nothing", async () => {
    const ok = (async () => response([ref(40, true)])) as unknown as typeof fetch;
    const bad = (async () => response({}, 500)) as unknown as typeof fetch;
    expect(await getIssuePrLinks([1], bad, null)).toEqual({});
    await getIssuePrLinks([1], ok, null);
    expect(await getIssuePrLinks([1], bad, null)).toEqual({ 1: prUrlFor(40) });
  });

  it("rejects oversized bodies", async () => {
    const big = (async () => new Response("[" + " ".repeat(1024 * 1024 + 1) + "]")) as unknown as typeof fetch;
    expect(await getIssuePrLinks([1], big, null)).toEqual({});
  });
});
