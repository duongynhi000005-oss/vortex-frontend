import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { svgToPngMock, downloadBlobMock } = vi.hoisted(() => ({
  svgToPngMock: vi.fn(),
  downloadBlobMock: vi.fn(),
}));

vi.mock("@/lib/export/svgToPng", () => ({
  svgToPng: svgToPngMock,
  downloadBlob: downloadBlobMock,
}));

vi.mock("@/components/Nav", () => ({ Nav: () => <nav data-testid="nav" /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));

vi.mock("@/hooks/useLiveIntents", () => ({
  useLiveIntents: () => ({
    intents: [
      {
        id: "1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "1000",
        dstToken: "XLM",
        solver: "solver-a",
        status: "filled",
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        srcChain: "base",
        srcToken: "WETH",
        srcAmount: "2",
        dstToken: "USDC",
        solver: "solver-b",
        status: "filled",
        createdAt: "2025-01-02T00:00:00Z",
      },
    ],
    isLoading: false,
    error: undefined,
    isLive: true,
  }),
}));

import AnalyticsPageClient from "./AnalyticsPageClient";

describe("RouteFlowPanel PNG Export (#603)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders the RouteFlowPanel with an accessible Sankey SVG diagram", () => {
    render(<AnalyticsPageClient />);

    // Assert that the Sankey SVG diagram is rendered with role="img"
    const sankeySvg = screen.getByRole("img", {
      name: /route flow sankey diagram/i,
    });
    expect(sankeySvg).toBeInTheDocument();
    expect(sankeySvg.tagName.toLowerCase()).toBe("svg");

    // Also assert volume chart SVG exists on the page
    const volumeChartSvg = screen.getByRole("img", {
      name: /analytics\.chart\.aria|protocol volume over time/i,
    });
    expect(volumeChartSvg).toBeInTheDocument();
    expect(sankeySvg).not.toBe(volumeChartSvg);
  });

  it("exports PNG produced from the Sankey SVG element (not the volume chart) in dark theme", async () => {
    const fakeBlob = new Blob(["fake-sankey-png"], { type: "image/png" });
    svgToPngMock.mockResolvedValue(fakeBlob);

    // Default theme (dark: #0f1117)
    document.documentElement.setAttribute("data-theme", "dark");

    render(<AnalyticsPageClient />);

    const sankeySvg = screen.getByRole("img", {
      name: /route flow sankey diagram/i,
    });
    const volumeChartSvg = screen.getByRole("img", {
      name: /analytics\.chart\.aria|protocol volume over time/i,
    });

    // Find the RouteFlowPanel's "Export as PNG" button
    const exportButton = screen.getByRole("button", {
      name: /export as png/i,
    });
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(svgToPngMock).toHaveBeenCalledTimes(1);
    });

    // Test that the exported blob is produced from the Sankey SVG element, not the volume chart's
    expect(svgToPngMock).toHaveBeenCalledWith(sankeySvg, {
      background: "#0f1117",
    });
    expect(svgToPngMock).not.toHaveBeenCalledWith(volumeChartSvg, expect.anything());

    const today = new Date().toISOString().slice(0, 10);
    expect(downloadBlobMock).toHaveBeenCalledWith(
      fakeBlob,
      `vortex-route-flow-${today}.png`,
    );
  });

  it("exports PNG with light background when light theme is active", async () => {
    const fakeBlob = new Blob(["fake-light-sankey-png"], { type: "image/png" });
    svgToPngMock.mockResolvedValue(fakeBlob);

    document.documentElement.setAttribute("data-theme", "light");

    render(<AnalyticsPageClient />);

    const sankeySvg = screen.getByRole("img", {
      name: /route flow sankey diagram/i,
    });

    const exportButton = screen.getByRole("button", {
      name: /export as png/i,
    });

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(svgToPngMock).toHaveBeenCalledTimes(1);
    });

    expect(svgToPngMock).toHaveBeenCalledWith(sankeySvg, {
      background: "#ffffff",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(downloadBlobMock).toHaveBeenCalledWith(
      fakeBlob,
      `vortex-route-flow-${today}.png`,
    );
  });
});
