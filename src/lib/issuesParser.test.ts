import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeContributorBreakdown, parseIssuesMarkdown } from "./issuesParser";

describe("parseIssuesMarkdown good-first-issue annotation", () => {
  it("reads `Good first issue: yes` and defaults to false", () => {
    const { issues } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Labelled (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes)
- #2 Unlabelled (Complexity: Trivial, Points: 50, Status: Open, Contributor: None)
- #3 Explicit no (Complexity: Medium, Points: 150, Status: Open, Contributor: None, Good first issue: no)
`);
    expect(issues.map((i) => [i.id, i.goodFirstIssue])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    expect(issues[0]).toMatchObject({ complexity: "Trivial", status: "Open", contributor: null });
  });

  it("reads an optional `Mentor:` handle", () => {
    const { issues } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Mentored (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes, Mentor: @octocat)
- #2 Bare handle (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes, Mentor: some-user)
- #3 No mentor (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes)
- #4 Mentor none (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Mentor: None)
`);
    expect(issues.map((i) => [i.id, i.mentor])).toEqual([
      [1, "octocat"],
      [2, "some-user"],
      [3, null],
      [4, null],
    ]);
  });

  it("flags exactly the curated issues in issues.md, all of them open", () => {
    const markdown = readFileSync(path.resolve(__dirname, "../../issues.md"), "utf8");
    const { issues } = parseIssuesMarkdown(markdown);

    const labelled = issues.filter((i) => i.goodFirstIssue);
    expect(labelled.map((i) => i.id).sort((a, b) => a - b)).toEqual([14, 19, 20, 28, 33, 43]);
    expect(labelled.every((i) => i.status === "Open")).toBe(true);

    // The curated summary list must not be parsed as duplicate issues.
    const ids = issues.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(issues.some((i) => i.category === "Good First Issues")).toBe(false);
  });
});

describe("computeContributorBreakdown", () => {
  it("returns zeroed breakdown for a contributor with no completed issues", () => {
    const { issues } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Open Issue (Complexity: Trivial, Points: 50, Status: Open, Contributor: None)
- #2 Completed By Other (Complexity: High, Points: 200, Status: Completed, Contributor: GOTHER)
`);
    const breakdown = computeContributorBreakdown(issues, "GUNKNOWN");
    expect(breakdown.contributor).toBe("GUNKNOWN");
    expect(breakdown.totalCompleted).toBe(0);
    expect(breakdown.totalPoints).toBe(0);
    expect(breakdown.categories).toEqual([]);
    expect(breakdown.complexities).toEqual([
      { complexity: "Trivial", count: 0, points: 0 },
      { complexity: "Medium", count: 0, points: 0 },
      { complexity: "High", count: 0, points: 0 },
    ]);
    expect(breakdown.completedIssues).toEqual([]);
  });

  it("computes tallies and verifies exact sum parity across categories and complexities", () => {
    const { issues } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Base Component (Complexity: High, Points: 200, Status: Completed, Contributor: GABC)
- #2 Token Selector (Complexity: Medium, Points: 150, Status: Completed, Contributor: GABC)
- #3 Slippage Panel (Complexity: Trivial, Points: 50, Status: In Progress, Contributor: GABC)

## Solver Network
- #28 Active Indicator (Complexity: Trivial, Points: 50, Status: Completed, Contributor: GABC)

## Governance
- #38 Proposal List (Complexity: High, Points: 200, Status: Completed, Contributor: GOTHER)
`);

    const breakdown = computeContributorBreakdown(issues, "GABC");
    expect(breakdown.contributor).toBe("GABC");
    expect(breakdown.totalCompleted).toBe(3);
    expect(breakdown.totalPoints).toBe(400);

    // Categories
    expect(breakdown.categories).toEqual([
      { category: "Core Swap UI", count: 2, points: 350 },
      { category: "Solver Network", count: 1, points: 50 },
    ]);

    // Complexities
    expect(breakdown.complexities).toEqual([
      { complexity: "Trivial", count: 1, points: 50 },
      { complexity: "Medium", count: 1, points: 150 },
      { complexity: "High", count: 1, points: 200 },
    ]);

    // Sum parity check: Definition of Done
    const catCountSum = breakdown.categories.reduce((sum, c) => sum + c.count, 0);
    const catPointsSum = breakdown.categories.reduce((sum, c) => sum + c.points, 0);
    const tierCountSum = breakdown.complexities.reduce((sum, c) => sum + c.count, 0);
    const tierPointsSum = breakdown.complexities.reduce((sum, c) => sum + c.points, 0);

    expect(catCountSum).toBe(breakdown.totalCompleted);
    expect(catPointsSum).toBe(breakdown.totalPoints);
    expect(tierCountSum).toBe(breakdown.totalCompleted);
    expect(tierPointsSum).toBe(breakdown.totalPoints);

    // Completed issues
    expect(breakdown.completedIssues.map((i) => i.id)).toEqual([1, 2, 28]);
  });
});
