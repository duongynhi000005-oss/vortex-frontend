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

describe("ContributorsPageClient contributor detail breakdown", () => {
  const breakdownMetrics = parseIssuesMarkdown(`
## Core Swap UI
- #1 Base Component (Complexity: High, Points: 200, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566)
- #2 Token Selector (Complexity: Medium, Points: 150, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566)
- #3 Slippage Panel (Complexity: Trivial, Points: 50, Status: Completed, Contributor: GDEF2233445566778899001122334455667788990011223344556677)
`);

  it("expands contributor breakdown on row click and collapses on second click", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={breakdownMetrics} />);

    expect(screen.queryByText("Contributor breakdown")).not.toBeInTheDocument();

    const gabcRow = screen.getByRole("button", { name: /GABC\.\.\.5566/ });
    expect(gabcRow).toHaveAttribute("aria-expanded", "false");

    await user.click(gabcRow);

    expect(gabcRow).toHaveAttribute("aria-expanded", "true");
    const breakdownEl = screen.getByText("Contributor breakdown").closest("tr")!;
    expect(within(breakdownEl).getByText("Contributor breakdown")).toBeInTheDocument();
    expect(within(breakdownEl).getByText("Complexity tiers")).toBeInTheDocument();
    expect(within(breakdownEl).getByText("Categories")).toBeInTheDocument();
    expect(within(breakdownEl).getByText("Completed issues (2)")).toBeInTheDocument();
    expect(within(breakdownEl).getByText("Base Component")).toBeInTheDocument();
    expect(within(breakdownEl).getByText("Token Selector")).toBeInTheDocument();

    // Second click collapses
    await user.click(gabcRow);
    expect(gabcRow).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Contributor breakdown")).not.toBeInTheDocument();
  });
});
