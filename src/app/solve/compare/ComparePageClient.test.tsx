import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));

let currentParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => currentParams,
}));

const ADDR1 = "GCOIRSSVZYNKMYHVDRVRIYXPMFHU2CHZAHOF4JJDVCO6QU4P3ACGK2GH";
const ADDR2 = "GBT2QGNSOKTDYCOWLEIYZEDJ4KWTWK4AC42W4WBOU6WUL5ADRYCMUCMM";

vi.mock("@/hooks/useSolvers", () => ({
  useSolvers: () => ({
    solvers: [
      {
        name: "Alpha Solver",
        address: ADDR1,
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
        address: ADDR2,
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
    ],
    isLoading: false,
    error: undefined,
  }),
}));

vi.mock("@/hooks/useIntentFeed", () => ({
  useIntentFeed: () => ({ items: [] }),
}));

import { ComparePageClient } from "./ComparePageClient";

describe("ComparePageClient Copy Link Action (#598)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentParams = new URLSearchParams();
  });

  it("does not render the copy link button when no valid solver addresses are in query params", () => {
    render(<ComparePageClient />);

    expect(screen.queryByRole("button", { name: /copy comparison link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copied/i })).not.toBeInTheDocument();
  });

  it("renders the copy link button when comparison addresses are present", () => {
    currentParams = new URLSearchParams(`a=${ADDR1}&b=${ADDR2}`);
    render(<ComparePageClient />);

    const copyBtn = screen.getByRole("button", { name: /copy comparison link/i });
    expect(copyBtn).toBeInTheDocument();
    expect(copyBtn).toHaveAttribute("aria-live", "polite");
  });

  it("copies window.location.href to clipboard and shows feedback upon click", async () => {
    vi.useFakeTimers();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    currentParams = new URLSearchParams(`a=${ADDR1}&b=${ADDR2}`);
    render(<ComparePageClient />);

    const copyBtn = screen.getByRole("button", { name: /copy comparison link/i });
    expect(copyBtn).toBeInTheDocument();

    await act(async () => {
      copyBtn.click();
    });

    expect(writeTextSpy).toHaveBeenCalledWith(window.location.href);

    // Feedback: button label should switch to "Copied"
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // After reset delay (1500ms), button label reverts back to "Copy comparison link"
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.getByRole("button", { name: /copy comparison link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^copied$/i })).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
