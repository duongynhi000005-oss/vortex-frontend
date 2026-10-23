import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { encodeShareState, decodeShareState, readShareStateFromUrl, SHARE_PARAM } from "@/lib/export/analyticsExport";

const { useLiveIntentsMock } = vi.hoisted(() => ({
  useLiveIntentsMock: vi.fn(),
}));

vi.mock("@/hooks/useLiveIntents", () => ({
  useLiveIntents: useLiveIntentsMock,
}));

vi.mock("@/components/Nav", () => ({ Nav: () => <nav data-testid="nav" /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));

import AnalyticsPageClient from "./AnalyticsPageClient";

describe("AnalyticsPageClient Share Link State Restoration (#601)", () => {
  const sampleIntents = [
    {
      id: "intent-1",
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "1000",
      dstToken: "XLM",
      solver: "solver-alpha",
      status: "filled",
      createdAt: "2025-01-10T12:00:00Z",
    },
    {
      id: "intent-2",
      srcChain: "base",
      srcToken: "WETH",
      srcAmount: "2",
      dstToken: "USDC",
      solver: "solver-beta",
      status: "filled",
      createdAt: "2025-01-15T12:00:00Z",
    },
    {
      id: "intent-3",
      srcChain: "stellar",
      srcToken: "XLM",
      srcAmount: "5000",
      dstToken: "USDC",
      solver: "solver-gamma",
      status: "filled",
      createdAt: "2025-01-20T12:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useLiveIntentsMock.mockReturnValue({
      intents: sampleIntents,
      isLoading: false,
      error: undefined,
      isLive: true,
    });
    // Reset window.location
    window.history.replaceState({}, "", "/analytics");
  });

  it("renders default view with no active filters bar when no ?av= param is present", () => {
    render(<AnalyticsPageClient />);

    expect(screen.queryByTestId("active-filters-bar")).not.toBeInTheDocument();
  });

  it("restores filter state from URL (?av=...) and displays active filter chips", () => {
    const encoded = encodeShareState({
      chain: "ethereum",
      token: "USDC",
      from: "2025-01-01",
      to: "2025-01-31",
    });

    window.history.replaceState({}, "", `/analytics?${SHARE_PARAM}=${encoded}`);

    render(<AnalyticsPageClient />);

    // Active filters bar should be rendered
    const filtersBar = screen.getByTestId("active-filters-bar");
    expect(filtersBar).toBeInTheDocument();

    // Badges should be displayed
    expect(screen.getByTestId("filter-badge-chain")).toHaveTextContent("Ethereum");
    expect(screen.getByTestId("filter-badge-token")).toHaveTextContent("USDC");
    expect(screen.getByTestId("filter-badge-from")).toBeInTheDocument();
    expect(screen.getByTestId("filter-badge-to")).toBeInTheDocument();
  });

  it("clears filters and removes active filter chips when 'Reset filters' is clicked", () => {
    const encoded = encodeShareState({ chain: "base" });
    window.history.replaceState({}, "", `/analytics?${SHARE_PARAM}=${encoded}`);

    render(<AnalyticsPageClient />);

    expect(screen.getByTestId("active-filters-bar")).toBeInTheDocument();

    const clearBtn = screen.getByTestId("clear-shared-filters-btn");
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId("active-filters-bar")).not.toBeInTheDocument();
  });

  it("copies shareable link with encoded active filters when user clicks 'Copy shareable link'", async () => {
    const encoded = encodeShareState({ chain: "ethereum", token: "USDC" });
    window.history.replaceState({}, "", `/analytics?${SHARE_PARAM}=${encoded}`);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<AnalyticsPageClient />);

    // Open Export dropdown
    const exportBtn = screen.getByRole("button", { name: /export analytics snapshot/i });
    fireEvent.click(exportBtn);

    // Click Copy shareable link
    const copyLinkBtn = screen.getByRole("menuitem", { name: /copy shareable link/i });
    fireEvent.click(copyLinkBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain(`${SHARE_PARAM}=`);
    expect(readShareStateFromUrl(copiedUrl)).toEqual({ chain: "ethereum", token: "USDC" });
  });
});
