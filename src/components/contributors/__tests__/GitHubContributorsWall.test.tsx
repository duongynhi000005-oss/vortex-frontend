import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
import { GitHubContributorsWall } from "../GitHubContributorsWall";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ContributorsResponse } from "@/lib/contributors";

// Mock next/image to render standard img with all props so onError and fill can be tested
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
    fill: _fill,
    sizes: _sizes,
    className,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    fill?: boolean;
    sizes?: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} className={className} data-testid={`avatar-${alt}`} />
  ),
}));

const mockLiveResponse: ContributorsResponse = {
  source: "live",
  contributors: [
    {
      login: "alice-dev",
      avatarUrl: "https://avatars.githubusercontent.com/alice-dev?s=160",
      profileUrl: "https://github.com/alice-dev",
      contributions: 42,
    },
    {
      login: "bob-core",
      avatarUrl: "https://avatars.githubusercontent.com/bob-core?s=160",
      profileUrl: "https://github.com/bob-core",
      contributions: 15,
    },
  ],
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <I18nProvider initialLocale="en">{ui}</I18nProvider>
    </SWRConfig>,
  );
};

describe("<GitHubContributorsWall />", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders live contributors with source badge, avatars, and links", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockLiveResponse), { status: 200 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    expect(await screen.findByText("@alice-dev")).toBeInTheDocument();
    expect(screen.getByText("@bob-core")).toBeInTheDocument();
    expect(screen.getByText("42 contributions")).toBeInTheDocument();
    expect(screen.getByText("15 contributions")).toBeInTheDocument();

    const badge = screen.getByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Live from GitHub");

    const aliceLink = screen.getByRole("link", { name: "View @alice-dev on GitHub" });
    expect(aliceLink).toHaveAttribute("href", "https://github.com/alice-dev");
    expect(aliceLink).toHaveAttribute("target", "_blank");
    expect(aliceLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("visibly distinguishes cached provenance state", async () => {
    const cachedResponse: ContributorsResponse = {
      ...mockLiveResponse,
      source: "cache",
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(cachedResponse), { status: 200 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    const badge = await screen.findByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Cached (1h window)");
  });

  it("visibly distinguishes offline fallback provenance state", async () => {
    const fallbackResponse: ContributorsResponse = {
      ...mockLiveResponse,
      source: "fallback",
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(fallbackResponse), { status: 200 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    const badge = await screen.findByTestId("contributors-source-badge");
    expect(badge).toHaveTextContent("Offline snapshot");
  });

  it("displays broken-image fallback initials when avatar image fails to load", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockLiveResponse), { status: 200 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    const img = await screen.findByTestId("avatar-alice-dev");
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByTestId("avatar-fallback-alice-dev")).toHaveTextContent("AL");
    });
  });

  it("renders empty state notice when contributor list is empty", async () => {
    const emptyResponse: ContributorsResponse = {
      source: "live",
      contributors: [],
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(emptyResponse), { status: 200 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    expect(await screen.findByText("No contributors found.")).toBeInTheDocument();
  });

  it("renders error alert when endpoint fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    renderWithProviders(<GitHubContributorsWall />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load contributors.");
  });

  it("renders initialData immediately when supplied via props", () => {
    renderWithProviders(<GitHubContributorsWall initialData={mockLiveResponse} />);

    expect(screen.getByText("@alice-dev")).toBeInTheDocument();
    expect(screen.getByText("@bob-core")).toBeInTheDocument();
    expect(screen.getByTestId("contributors-source-badge")).toHaveTextContent("Live from GitHub");
  });
});
