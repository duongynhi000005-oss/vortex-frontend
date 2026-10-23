import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseIssuesMarkdown } from "@/lib/issuesParser";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));

const replaceMock = vi.fn();
let currentParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/contributors",
  useSearchParams: () => currentParams,
}));

import ContributorsPageClient from "./ContributorsPageClient";

const metrics = parseIssuesMarkdown(`
## Solver Network
- #28 Active Solver Uptime Indicator (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes)
- #29 Solver Performance Graph (Complexity: Medium, Points: 150, Status: Open, Contributor: None)
`);

describe("ContributorsPageClient good-first-issue filter", () => {
  it("badges curated issues and can filter down to them", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={metrics} />);

    const uptimeRow = screen.getByText("Active Solver Uptime Indicator").closest("tr")!;
    expect(within(uptimeRow).getByText("Good first issue")).toBeInTheDocument();
    expect(screen.getByText("Solver Performance Graph")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Good first issues only"));

    expect(screen.getByText("Active Solver Uptime Indicator")).toBeInTheDocument();
    expect(screen.queryByText("Solver Performance Graph")).not.toBeInTheDocument();
  });
});

describe("ContributorsPageClient URL-persisted filters", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    currentParams = new URLSearchParams();
  });

  it("writes filter changes to the URL without scrolling", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={metrics} />);

    await user.click(screen.getByLabelText("Good first issues only"));
    expect(replaceMock).toHaveBeenLastCalledWith("/contributors?goodFirstOnly=1", { scroll: false });

    await user.click(screen.getByLabelText("Good first issues only"));
    expect(replaceMock).toHaveBeenLastCalledWith("/contributors", { scroll: false });
  });

  it("pre-populates the controls from query params", () => {
    currentParams = new URLSearchParams("goodFirstOnly=1&complexity=Trivial&q=uptime");
    render(<ContributorsPageClient metrics={metrics} />);

    expect(screen.getByLabelText("Good first issues only")).toBeChecked();
    expect(screen.getByDisplayValue("uptime")).toBeInTheDocument();
    expect(screen.getByText("Active Solver Uptime Indicator")).toBeInTheDocument();
    expect(screen.queryByText("Solver Performance Graph")).not.toBeInTheDocument();
  });

  it("falls back to defaults for invalid query params", () => {
    currentParams = new URLSearchParams("status=Bogus&complexity=Huge&category=Nope");
    render(<ContributorsPageClient metrics={metrics} />);

    expect(screen.getByText("Active Solver Uptime Indicator")).toBeInTheDocument();
    expect(screen.getByText("Solver Performance Graph")).toBeInTheDocument();
  });
});

describe("ContributorsPageClient mentor affordance", () => {
  it("links to the mentor's GitHub profile only when a mentor is set", () => {
    currentParams = new URLSearchParams();
    const mentored = parseIssuesMarkdown(`
## Solver Network
- #28 Mentored Issue (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes, Mentor: octocat)
- #29 Plain Issue (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes)
`);
    render(<ContributorsPageClient metrics={mentored} />);

    const link = screen.getByRole("link", { name: "Ask @octocat about this one" });
    expect(link).toHaveAttribute("href", "https://github.com/octocat");
    expect(screen.getAllByRole("link", { name: /Ask @/ })).toHaveLength(1);
  });
});

describe("ContributorsPageClient leaderboard velocity sort toggle", () => {
  const leaderboardMetrics = parseIssuesMarkdown(`
## Core Swap UI
- #1 Fast Contributor (Complexity: Medium, Points: 150, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566, Completed: 2026-03-01)
- #2 High Points Undated (Complexity: High, Points: 200, Status: Completed, Contributor: GDEF2233445566778899001122334455667788990011223344556677)
`);

  it("toggles velocity sort mode and displays velocity column and note", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={leaderboardMetrics} />);

    // By default, sorted by points: GDEF (200 pts) first, then GABC (150 pts)
    const rowsBefore = screen.getAllByRole("row");
    expect(rowsBefore[1]!).toHaveTextContent("GDEF...6677");
    expect(rowsBefore[2]!).toHaveTextContent("GABC...5566");
    expect(screen.queryByRole("columnheader", { name: "Velocity" })).not.toBeInTheDocument();

    const sortButton = screen.getByRole("button", { name: "Sort by velocity" });
    expect(sortButton).toHaveAttribute("aria-pressed", "false");

    await user.click(sortButton);

    // Now sorted by velocity: GABC (150 pts/wk) first, then GDEF (undated)
    expect(screen.getByRole("button", { name: "Sort by total points" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("columnheader", { name: "Velocity" })).toBeInTheDocument();
    expect(
      screen.getByText(/Contributors with at least one dated completion are ranked by points per week/)
    ).toBeInTheDocument();

    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]!).toHaveTextContent("GABC...5566");
    expect(rowsAfter[1]!).toHaveTextContent("150 pts/wk");
    expect(rowsAfter[2]!).toHaveTextContent("GDEF...6677");
    expect(rowsAfter[2]!).toHaveTextContent("—");

    // Click again to toggle back
    await user.click(screen.getByRole("button", { name: "Sort by total points" }));
    expect(screen.getByRole("button", { name: "Sort by velocity" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("columnheader", { name: "Velocity" })).not.toBeInTheDocument();
  });
});
