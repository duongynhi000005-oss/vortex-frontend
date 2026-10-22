import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DelegatesPage from "./page";

// Mounts the page with the real useDelegation hook so a hook signature change
// fails here instead of only at runtime.
describe("DelegatesPage", () => {
  it("renders the directory from the hook and starts a delegation review", async () => {
    render(<DelegatesPage />);
    expect(screen.getByRole("heading", { name: "Voting delegation" })).toBeInTheDocument();
    expect(await screen.findByText("Stellar Builders")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Delegate" })[0]);
    expect(screen.getByRole("button", { name: /Simulate, sign/ })).toBeInTheDocument();
  });

  it("rejects an invalid manual address", () => {
    render(<DelegatesPage />);
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "not-an-address" } });
    fireEvent.click(screen.getByRole("button", { name: "Review delegation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid Stellar address");
  });
});
