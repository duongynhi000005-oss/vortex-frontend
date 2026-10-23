import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { filterAnalyticsIntents } from "@/lib/analytics";
import { readShareStateFromUrl, SHARE_PARAM } from "@/lib/export/analyticsExport";

const { useLiveIntentsMock } = vi.hoisted(() => ({
  useLiveIntentsMock: vi.fn(),
}));

vi.mock("@/hooks/useLiveIntents", () => ({
  useLiveIntents: useLiveIntentsMock,
}));

vi.mock("@/components/Nav", () => ({ Nav: () => <nav data-testid="nav" /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));

import AnalyticsPageClient from "./AnalyticsPageClient";

describe("Analytics Filter Controls (Issue #600)", () => {
  const sampleIntents = [
    {
      id: "intent-1",
      srcChain: "ethereum",
      dstChain: "stellar",
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
      dstChain: "arbitrum",
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
      dstChain: "base",
      srcToken: "XLM",
      srcAmount: "5000",
      dstToken: "USDC",
      solver: "solver-gamma",
      status: "filled",
      createdAt: "2025-01-20T12:00:00Z",
    },
  ];

  describe("filterAnalyticsIntents unit tests", () => {
    it("returns all intents when no filters are active", () => {
      const result = filterAnalyticsIntents(sampleIntents, {});
      expect(result).toHaveLength(3);
    });

    it("filters intents by network (matching srcChain or dstChain)", () => {
      const ethResult = filterAnalyticsIntents(sampleIntents, { chain: "ethereum" });
      expect(ethResult).toHaveLength(1);
      expect(ethResult[0].id).toBe("intent-1");

      const baseResult = filterAnalyticsIntents(sampleIntents, { chain: "base" });
      expect(baseResult).toHaveLength(2); // intent-2 (src) and intent-3 (dst)
    });

    it("filters intents by token (matching srcToken or dstToken)", () => {
      const xlmResult = filterAnalyticsIntents(sampleIntents, { token: "XLM" });
      expect(xlmResult).toHaveLength(2); // intent-1 (dst) and intent-3 (src)

      const wethResult = filterAnalyticsIntents(sampleIntents, { token: "WETH" });
      expect(wethResult).toHaveLength(1);
      expect(wethResult[0].id).toBe("intent-2");
    });

    it("filters intents by date range (from and to boundaries)", () => {
      const rangeResult = filterAnalyticsIntents(sampleIntents, {
        from: "2025-01-12T00:00:00Z",
        to: "2025-01-18T00:00:00Z",
      });
      expect(rangeResult).toHaveLength(1);
      expect(rangeResult[0].id).toBe("intent-2");
    });

    it("combines multiple filter dimensions simultaneously", () => {
      const combined = filterAnalyticsIntents(sampleIntents, {
        chain: "stellar",
        token: "USDC",
        from: "2025-01-18T00:00:00Z",
      });
      expect(combined).toHaveLength(1);
      expect(combined[0].id).toBe("intent-3");
    });

    it("handles empty intent lists gracefully without crashing", () => {
      const result = filterAnalyticsIntents([], { chain: "stellar" });
      expect(result).toEqual([]);
    });
  });

  describe("AnalyticsPageClient Filter Controls component tests", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      useLiveIntentsMock.mockReturnValue({
        intents: sampleIntents,
        isLoading: false,
        error: undefined,
        isLive: true,
      });
      window.history.replaceState({}, "", "/analytics");
    });

    it("renders the filter controls toolbar with presets, date inputs, and dropdowns", () => {
      render(<AnalyticsPageClient />);

      expect(screen.getByTestId("analytics-filter-bar")).toBeInTheDocument();
      expect(screen.getByTestId("filter-preset-24h")).toBeInTheDocument();
      expect(screen.getByTestId("filter-preset-7d")).toBeInTheDocument();
      expect(screen.getByTestId("filter-preset-30d")).toBeInTheDocument();
      expect(screen.getByTestId("filter-preset-all")).toBeInTheDocument();
      expect(screen.getByTestId("filter-input-date-from")).toBeInTheDocument();
      expect(screen.getByTestId("filter-input-date-to")).toBeInTheDocument();
      expect(screen.getByTestId("filter-select-chain")).toBeInTheDocument();
      expect(screen.getByTestId("filter-select-token")).toBeInTheDocument();
    });

    it("filters dataset when selecting a chain from the chain dropdown", () => {
      render(<AnalyticsPageClient />);

      const chainSelect = screen.getByTestId("filter-select-chain");
      fireEvent.change(chainSelect, { target: { value: "ethereum" } });

      // Active filters bar appears
      expect(screen.getByTestId("active-filters-bar")).toBeInTheDocument();
      expect(screen.getByTestId("filter-badge-chain")).toHaveTextContent("Ethereum");
    });

    it("filters dataset when selecting a token from the token dropdown", () => {
      render(<AnalyticsPageClient />);

      const tokenSelect = screen.getByTestId("filter-select-token");
      fireEvent.change(tokenSelect, { target: { value: "USDC" } });

      expect(screen.getByTestId("active-filters-bar")).toBeInTheDocument();
      expect(screen.getByTestId("filter-badge-token")).toHaveTextContent("USDC");
    });

    it("updates date boundaries when entering custom date range inputs", () => {
      render(<AnalyticsPageClient />);

      const fromInput = screen.getByTestId("filter-input-date-from");
      fireEvent.change(fromInput, { target: { value: "2025-01-10" } });

      const toInput = screen.getByTestId("filter-input-date-to");
      fireEvent.change(toInput, { target: { value: "2025-01-20" } });

      expect(screen.getByTestId("active-filters-bar")).toBeInTheDocument();
      expect(screen.getByTestId("filter-badge-from")).toBeInTheDocument();
      expect(screen.getByTestId("filter-badge-to")).toBeInTheDocument();
    });

    it("resets all filters when clicking 'Reset filters' button in the toolbar", () => {
      render(<AnalyticsPageClient />);

      // Select chain
      const chainSelect = screen.getByTestId("filter-select-chain");
      fireEvent.change(chainSelect, { target: { value: "base" } });
      expect(screen.getByTestId("active-filters-bar")).toBeInTheDocument();

      // Reset button in toolbar
      const resetBtn = screen.getByTestId("filter-reset-button");
      fireEvent.click(resetBtn);

      expect(screen.queryByTestId("active-filters-bar")).not.toBeInTheDocument();
      expect((screen.getByTestId("filter-select-chain") as HTMLSelectElement).value).toBe("");
    });

    it("encodes interactive filter selections into the share URL", () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<AnalyticsPageClient />);

      // Select chain & token
      fireEvent.change(screen.getByTestId("filter-select-chain"), { target: { value: "ethereum" } });
      fireEvent.change(screen.getByTestId("filter-select-token"), { target: { value: "XLM" } });

      // Open Export dropdown & copy link
      const exportBtn = screen.getByRole("button", { name: /export analytics snapshot/i });
      fireEvent.click(exportBtn);

      const copyLinkBtn = screen.getByRole("menuitem", { name: /copy shareable link/i });
      fireEvent.click(copyLinkBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedUrl = writeTextMock.mock.calls[0][0];
      expect(copiedUrl).toContain(`${SHARE_PARAM}=`);
      expect(readShareStateFromUrl(copiedUrl)).toEqual({ chain: "ethereum", token: "XLM" });
    });
  });
});
