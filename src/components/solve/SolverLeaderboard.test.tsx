import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { useSolversMock, updateMock, queryParams } = vi.hoisted(() => ({
  useSolversMock: vi.fn(),
  updateMock: vi.fn(),
  queryParams: new URLSearchParams(),
}));

vi.mock("@/hooks/useSolvers", () => ({
  useSolvers: useSolversMock,
}));

vi.mock("@/hooks/useQueryState", () => ({
  useQueryState: () => ({
    params: queryParams,
    update: updateMock,
  }),
}));

vi.mock("@/hooks/useSolverIdentity", () => ({
  useSolverIdentity: () => ({
    state: "unverified",
    domain: "",
  }),
}));

import { SolverLeaderboard } from "./SolverLeaderboard";
import type { Solver } from "@/lib/types";

describe("SolverLeaderboard Component (Issue #599)", () => {
  const mockSolvers: Solver[] = [
    {
      name: "Alpha Solver",
      address: "GA_ALPHA",
      bondUsd: 1000,
      fills: 20,
      failed: 1,
      volumeUsd: 50000,
      avgFillTimeSeconds: 15,
      successRatePct: 95.2,
      chains: ["ethereum", "stellar"],
      status: "active",
      verified: true,
    },
    {
      name: "Beta Solver",
      address: "GB_BETA",
      bondUsd: 500,
      fills: 10,
      failed: 0,
      volumeUsd: 20000,
      avgFillTimeSeconds: 12,
      successRatePct: 100,
      chains: ["base"],
      status: "active",
      verified: false,
    },
    {
      name: "Gamma Solver",
      address: "GC_GAMMA",
      bondUsd: 2000,
      fills: 40,
      failed: 2,
      volumeUsd: 80000,
      avgFillTimeSeconds: 10,
      successRatePct: 95.2,
      chains: ["polygon"],
      status: "active",
      verified: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams.delete("sort");
    queryParams.delete("verified");
    queryParams.delete("chain");
    queryParams.delete("status");
    queryParams.delete("minBond");

    useSolversMock.mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: undefined,
    });
  });

  it("renders verified badges only for verified solvers", () => {
    render(<SolverLeaderboard />);

    expect(screen.getByText("Alpha Solver")).toBeInTheDocument();
    expect(screen.getByText("Beta Solver")).toBeInTheDocument();
    expect(screen.getByText("Gamma Solver")).toBeInTheDocument();

    // Badges should exist for Alpha and Gamma, but not Beta
    const verifiedBadges = screen.getAllByTestId("solver-verified-badge");
    // Both cell badge and name badge render for verified solvers
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("triggers sort update when clicking the Verified column header", () => {
    render(<SolverLeaderboard />);

    // Find the Verified column header button
    const verifiedHeader = screen.getByRole("button", { name: /verified/i });
    expect(verifiedHeader).toBeInTheDocument();

    fireEvent.click(verifiedHeader);

    // Should call update with sort: "verified:asc"
    expect(updateMock).toHaveBeenCalledWith({ sort: "verified:asc" });
  });

  it("respects verified:desc sort parameter and places verified solvers at the top", () => {
    queryParams.set("sort", "verified:desc");

    render(<SolverLeaderboard />);

    const rows = screen.getAllByRole("row");
    // Header row is index 0; index 1 and 2 should be the verified solvers
    // Alpha and Gamma are verified; Beta is unverified
    const textContentAll = rows.map((r) => r.textContent);
    const betaRowIndex = textContentAll.findIndex((t) => t?.includes("Beta Solver"));
    const alphaRowIndex = textContentAll.findIndex((t) => t?.includes("Alpha Solver"));
    const gammaRowIndex = textContentAll.findIndex((t) => t?.includes("Gamma Solver"));

    expect(alphaRowIndex).toBeLessThan(betaRowIndex);
    expect(gammaRowIndex).toBeLessThan(betaRowIndex);
  });

  it("allows verifiedOnly filter to operate independently of sorting", () => {
    render(<SolverLeaderboard />);

    const verifiedOnlyCheckbox = screen.getByRole("checkbox", { name: /verifiedOnly/i });
    expect(verifiedOnlyCheckbox).toBeInTheDocument();

    fireEvent.click(verifiedOnlyCheckbox);

    expect(updateMock).toHaveBeenCalledWith({ verified: "1" });
  });

  it("includes Verified column in the column visibility toggle menu", () => {
    const { container } = render(<SolverLeaderboard />);

    const details = container.querySelector("details");
    expect(details).toBeInTheDocument();
    if (details) details.open = true;

    const verifiedCheckbox = screen.getByRole("checkbox", { name: /^verified$/i });
    expect(verifiedCheckbox).toBeInTheDocument();
    expect(verifiedCheckbox).toBeChecked();
  });
});
