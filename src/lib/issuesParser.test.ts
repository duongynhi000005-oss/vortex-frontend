import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computePointsPerWeek,
  parseIssuesMarkdown,
  sortLeaderboardByVelocity,
  type ContributorTally,
} from "./issuesParser";

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

describe("parseIssuesMarkdown completedAt date parsing", () => {
  it("parses valid Completed: YYYY-MM-DD and handles None or missing dates", () => {
    const { issues } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Dated (Complexity: Medium, Points: 150, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566, Completed: 2026-03-15)
- #2 None (Complexity: Trivial, Points: 50, Status: Completed, Contributor: GDEF2233445566778899001122334455667788990011223344556677, Completed: None)
- #3 Undated (Complexity: High, Points: 200, Status: Completed, Contributor: GHIJ3344556677889900112233445566778899001122334455667788)
`);
    expect(issues[0]!.completedAt).toBe("2026-03-15");
    expect(issues[1]!.completedAt).toBeNull();
    expect(issues[2]!.completedAt).toBeNull();
  });

  it("reports a warning for malformed Completed dates and leaves completedAt null", () => {
    const { issues, warnings } = parseIssuesMarkdown(`
## Core Swap UI
- #1 Bad Date (Complexity: Medium, Points: 150, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566, Completed: 15-03-2026)
`);
    expect(issues[0]!.completedAt).toBeNull();
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'malformed Completed date "15-03-2026", expected YYYY-MM-DD',
        }),
      ])
    );
  });
});

describe("computePointsPerWeek", () => {
  it("returns null when no completed issues have dates", () => {
    expect(computePointsPerWeek([])).toBeNull();
    expect(
      computePointsPerWeek([
        { points: 50, completedAt: null },
        { points: 150, completedAt: null },
      ])
    ).toBeNull();
  });

  it("uses 1 week minimum divisor for single completion or same-day completions", () => {
    const velocity = computePointsPerWeek([{ points: 150, completedAt: "2026-02-01" }]);
    expect(velocity).toBe(150);

    const sameDay = computePointsPerWeek([
      { points: 50, completedAt: "2026-02-01" },
      { points: 150, completedAt: "2026-02-01" },
    ]);
    expect(sameDay).toBe(200);
  });

  it("computes points per week correctly across multi-week spans", () => {
    const velocity = computePointsPerWeek([
      { points: 200, completedAt: "2026-01-10" },
      { points: 50, completedAt: "2026-01-24" },
    ]);
    expect(velocity).toBe(125);
  });
});

describe("sortLeaderboardByVelocity", () => {
  it("partitions dated contributors before undated, sorting dated by velocity desc", () => {
    const leaderboard: ContributorTally[] = [
      {
        contributor: "G_UNDATED_HIGH",
        completedCount: 5,
        pointsEarned: 1000,
        pointsPerWeek: null,
        datedCompletedCount: 0,
      },
      {
        contributor: "G_DATED_SLOW",
        completedCount: 2,
        pointsEarned: 200,
        pointsPerWeek: 50,
        datedCompletedCount: 2,
      },
      {
        contributor: "G_DATED_FAST",
        completedCount: 1,
        pointsEarned: 150,
        pointsPerWeek: 150,
        datedCompletedCount: 1,
      },
      {
        contributor: "G_UNDATED_LOW",
        completedCount: 1,
        pointsEarned: 50,
        pointsPerWeek: null,
        datedCompletedCount: 0,
      },
    ];

    const sorted = sortLeaderboardByVelocity(leaderboard);
    expect(sorted.map((c) => c.contributor)).toEqual([
      "G_DATED_FAST",
      "G_DATED_SLOW",
      "G_UNDATED_HIGH",
      "G_UNDATED_LOW",
    ]);
  });

  it("breaks ties by pointsEarned desc then contributor asc", () => {
    const leaderboard: ContributorTally[] = [
      {
        contributor: "GBBB",
        completedCount: 1,
        pointsEarned: 100,
        pointsPerWeek: 100,
        datedCompletedCount: 1,
      },
      {
        contributor: "GAAA",
        completedCount: 1,
        pointsEarned: 100,
        pointsPerWeek: 100,
        datedCompletedCount: 1,
      },
      {
        contributor: "GCCC",
        completedCount: 2,
        pointsEarned: 200,
        pointsPerWeek: 100,
        datedCompletedCount: 2,
      },
    ];

    const sorted = sortLeaderboardByVelocity(leaderboard);
    expect(sorted.map((c) => c.contributor)).toEqual(["GCCC", "GAAA", "GBBB"]);
  });
});
