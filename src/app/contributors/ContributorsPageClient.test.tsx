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

describe("ContributorsPageClient per-contributor detail view", () => {
  const detailMetrics = parseIssuesMarkdown(`
## Core Swap UI
- #1 Base Component (Complexity: High, Points: 200, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566)
- #2 Token Selector (Complexity: Medium, Points: 150, Status: Completed, Contributor: GDEF2233445566778899001122334455667788990011223344556677)
- #3 Slippage Panel (Complexity: Trivial, Points: 50, Status: Completed, Contributor: GABC1122334455667788990011223344556677889900112233445566)
`);

  it("expands contributor detail view on click and lists their completed issues", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={detailMetrics} />);

    const gabcRow = screen.getByRole("button", { name: /GABC\.\.\.5566/ });
    expect(gabcRow).toHaveAttribute("aria-expanded", "false");

    await user.click(gabcRow);

    expect(gabcRow).toHaveAttribute("aria-expanded", "true");
    const detailRow = screen.getByText("Completed issues by GABC...5566").closest("tr")!;
    expect(within(detailRow).getByText("Base Component")).toBeInTheDocument();
    expect(within(detailRow).getByText("Slippage Panel")).toBeInTheDocument();
    expect(within(detailRow).queryByText("Token Selector")).not.toBeInTheDocument();
    expect(within(detailRow).getByText("2 completed issues")).toBeInTheDocument();
    expect(within(detailRow).getByText("250 total points")).toBeInTheDocument();

    // Toggle collapse on second click
    await user.click(gabcRow);
    expect(gabcRow).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Completed issues by GABC...5566")).not.toBeInTheDocument();
  });

  it("toggles expansion using Enter keyboard key", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={detailMetrics} />);

    const gdefRow = screen.getByRole("button", { name: /GDEF\.\.\.6677/ });
    gdefRow.focus();
    await user.keyboard("{Enter}");

    expect(gdefRow).toHaveAttribute("aria-expanded", "true");
    const detailRow = screen.getByText("Completed issues by GDEF...6677").closest("tr")!;
    expect(within(detailRow).getByText("Token Selector")).toBeInTheDocument();
    expect(within(detailRow).getByText("1 completed issues")).toBeInTheDocument();
    expect(within(detailRow).getByText("150 total points")).toBeInTheDocument();
  });
});
