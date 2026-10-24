import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Solver, FeedItem } from "@/lib/types";

const SOLVER_A = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";
const SOLVER_B = "GBIQWBNH6YITCT3UI7WAQIXH2SOZHXNTY34Q4TBMZU3ZYMFIV6DDYQ6O";

const mockSolvers: Solver[] = [
  {
    name: "Alpha Solver",
    address: SOLVER_A,
    bondUsd: 100,
    fills: 5,
    failed: 0,
    volumeUsd: 5000,
    avgFillTimeSeconds: 12,
    successRatePct: 100,
    chains: ["ethereum"],
    status: "active",
  },
  {
    name: "Beta Solver",
    address: SOLVER_B,
    bondUsd: 50,
    fills: 0,
    failed: 0,
    volumeUsd: 0,
    avgFillTimeSeconds: 0,
    successRatePct: 0,
    chains: ["stellar"],
    status: "active",
  },
];

const mockItems: FeedItem[] = [
  {
    id: "f1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "100",
    dstToken: "XLM",
    solver: SOLVER_A,
    status: "filled",
    createdAt: "2025-01-01T12:00:00Z",
  },
  {
    id: "f2",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "200",
    dstToken: "XLM",
    solver: SOLVER_A,
    status: "filled",
    createdAt: "2025-01-02T12:00:00Z",
  },
  {
    id: "f3",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "150",
    dstToken: "XLM",
    solver: SOLVER_A,
    status: "filled",
    createdAt: "2025-01-15T12:00:00Z",
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/solve",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useSolvers", () => ({
  useSolvers: () => ({
    solvers: mockSolvers,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useIntentFeed", () => ({
  useIntentFeed: () => ({
    items: mockItems,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useSolverIdentity", () => ({
  useSolverIdentity: () => ({ state: "unverified" }),
}));

import { SolverLeaderboard } from "./SolverLeaderboard";

describe("SolverLeaderboard Volume Trend Sparkline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 7W Trend column header", () => {
    render(<SolverLeaderboard />);
    const headers = screen.getAllByRole("columnheader");
    const trendHeader = headers.find((h) => h.textContent?.includes("7W Trend"));
    expect(trendHeader).toBeTruthy();
    // Verify non-sortable status: no sort button inside the header
    expect(within(trendHeader!).queryByRole("button")).toBeNull();
  });

  it("renders sparkline SVG with accessible table fallback for solvers with fills", () => {
    render(<SolverLeaderboard />);
    // Solver A has fills, should render an SVG sparkline and accessible summary
    const sparklineSvg = screen.getByRole("img", {
      name: /Weekly fill volume trend for Alpha Solver over 2 weeks/i,
    });
    expect(sparklineSvg).toBeTruthy();
    expect(sparklineSvg.querySelector("polyline")).toBeTruthy();

    // Verify accessible table fallback is present in DOM
    const tables = screen.getAllByRole("table");
    const srTable = tables.find((t) => t.textContent?.includes("Alpha Solver"))!;
    expect(srTable).toBeTruthy();
    expect(srTable.textContent).toContain("Alpha Solver");
    expect(srTable.textContent).toContain("2025-W01");
    expect(srTable.textContent).toContain("2025-W03");
  });

  it("renders accessible empty state text for solvers with no fills", () => {
    render(<SolverLeaderboard />);
    // Solver B has 0 fills, should render "No recent fills"
    expect(screen.getByText("No recent fills")).toBeTruthy();
  });
});
