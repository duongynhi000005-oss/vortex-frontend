import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import VoterHistoryPage from "./page";

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("VoterHistoryPage", () => {
  it("renders participation stats for a valid address", async () => {
    render(await VoterHistoryPage({ params: { address: ADDRESS }, searchParams: {} }));
    expect(screen.getByRole("heading", { name: "Voter history" })).toBeInTheDocument();
    expect(screen.getByText("Participation rate")).toBeInTheDocument();
  });
});
