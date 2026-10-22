import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIssuesMarkdown } from "./issuesParser";

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
