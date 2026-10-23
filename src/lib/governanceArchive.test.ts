import { describe, it, expect } from "vitest";
import { buildArchiveCsv, filterArchiveProposals } from "@/lib/governanceArchive";
import type { GovernanceProposal } from "@/lib/governanceStore";

function proposal(over: Partial<GovernanceProposal>): GovernanceProposal {
  return {
    id: "p1",
    title: "Title",
    description: "Desc",
    proposer: "G...",
    category: "treasury",
    status: "passed",
    votesFor: 3,
    votesAgainst: 1,
    createdAt: "2026-01-01T00:00:00Z",
    deadline: "2026-01-08T00:00:00Z",
    ...over,
  };
}

const data = [
  proposal({ id: "a", title: "Alpha", createdAt: "2026-01-01T00:00:00Z" }),
  proposal({ id: "b", title: "=HYPERLINK(\"http://evil\")", status: "rejected", createdAt: "2026-02-01T00:00:00Z" }),
  proposal({ id: "c", title: "Gamma, with comma", category: "params", createdAt: "2026-03-01T00:00:00Z" }),
];

describe("governance archive CSV", () => {
  it("CSV rows match the filtered HTML rows for the same params", () => {
    const params = { category: "treasury", sort: "oldest" };
    const ids = filterArchiveProposals(data, params).map((p) => p.id);
    const csvIds = buildArchiveCsv(data, params).split("\n").slice(1).map((l) => l.split(",")[0]);
    expect(ids).toEqual(["a", "b"]);
    expect(csvIds).toEqual(ids);
  });

  it("neutralises formula injection in exported fields", () => {
    const csv = buildArchiveCsv(data, { status: "rejected" });
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv.split("\n")[1]).not.toMatch(/^b,=/);
  });

  it("matches the snapshot for a fixed filter set", () => {
    expect(buildArchiveCsv(data, { category: "params" })).toMatchInlineSnapshot(`
      "id,title,category,status,votesFor,votesAgainst,votesAbstain,createdAt,executedAt
      c,"Gamma, with comma",params,passed,3,1,0,2026-03-01T00:00:00Z,"
    `);
  });
});
