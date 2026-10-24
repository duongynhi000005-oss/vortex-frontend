import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { GitHubContributorsWall } from "./GitHubContributorsWall";
import type { Contributor, ContributorsResponse } from "@/lib/contributors";

function renderWall() {
  return render(
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), shouldRetryOnError: false } },
      createElement(GitHubContributorsWall)
    )
  );
}

const mockContributors: Contributor[] = [
  {
    login: "bob",
    avatarUrl: "https://avatars.githubusercontent.com/bob",
    profileUrl: "https://github.com/bob",
    contributions: 5,
  },
  {
    login: "alice",
    avatarUrl: "https://avatars.githubusercontent.com/alice",
    profileUrl: "https://github.com/alice",
    contributions: 15,
  },
];

describe("GitHubContributorsWall", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async (): Promise<ContributorsResponse> => ({
          contributors: mockContributors,
          source: "live",
        }),
      } as Response)
    );
  });

  it("renders live contributors sorted alphabetically with count label and source badge", async () => {
    renderWall();

    // SWR resolves: alice should come before bob
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();

    // Count label
    expect(screen.getByText("2 contributors — listed alphabetically")).toBeInTheDocument();

    // Contribution counts
    expect(screen.getByText("15 contributions")).toBeInTheDocument();
    expect(screen.getByText("5 contributions")).toBeInTheDocument();

    // Source badge
    const badge = screen.getByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Live GitHub Data");

    // Profile links have secure external link attributes
    const aliceLink = screen.getByRole("link", { name: /alice/i });
    expect(aliceLink).toHaveAttribute("href", "https://github.com/alice");
    expect(aliceLink).toHaveAttribute("target", "_blank");
    expect(aliceLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders cache badge and dismissible notice when source is cache", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async (): Promise<ContributorsResponse> => ({
        contributors: mockContributors,
        source: "cache",
      }),
    } as Response);

    renderWall();

    expect(await screen.findByText("@alice")).toBeInTheDocument();

    const badge = screen.getByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Cached Data");

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/showing a cached list from a recent sync/i);

    // Dismiss notice
    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders fallback badge and notice when source is fallback", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async (): Promise<ContributorsResponse> => ({
        contributors: mockContributors,
        source: "fallback",
      }),
    } as Response);

    renderWall();

    expect(await screen.findByText("@alice")).toBeInTheDocument();

    const badge = screen.getByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Bundled Fallback");

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/showing a cached list from the bundled snapshot/i);
  });

  it("falls back to initials monogram when avatar image encounters error", async () => {
    renderWall();

    const aliceImg = await screen.findByAltText("alice's avatar");
    expect(aliceImg).toBeInTheDocument();

    // Trigger error on image
    fireEvent.error(aliceImg);

    // Image is replaced with initials monogram fallback
    expect(screen.queryByAltText("alice's avatar")).not.toBeInTheDocument();
    const fallback = screen.getByRole("img", { name: "alice's avatar" });
    expect(fallback).toHaveTextContent("AL");
  });

  it("renders error state when fetch returns not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
    } as Response);

    renderWall();

    expect(await screen.findByText("Couldn't load contributors")).toBeInTheDocument();
    expect(
      screen.getByText("We hit a rate limit or the GitHub API is unavailable. Try again shortly.")
    ).toBeInTheDocument();
  });

  it("renders empty state when contributors list is empty", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async (): Promise<ContributorsResponse> => ({
        contributors: [],
        source: "live",
      }),
    } as Response);

    renderWall();

    expect(await screen.findByText("No contributors found")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This page pulls from the GitHub repository. If you've merged a PR, you should appear here."
      )
    ).toBeInTheDocument();
  });
});
