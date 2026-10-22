import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GovernanceArchivePage from "./page";

describe("GovernanceArchivePage", () => {
  it("renders proposals from the governance store", async () => {
    render(await GovernanceArchivePage({ searchParams: {} }));
    expect(screen.getByRole("heading", { name: "Governance Archive" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
