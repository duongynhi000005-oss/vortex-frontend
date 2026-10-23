import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockAddress: string | null = null;

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: () => ({
    address: mockAddress,
    isConnected: mockAddress !== null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

import { resetSupportRequests, submitSupportRequest } from "@/lib/supportRequestStore";
import RequestsPageClient from "./RequestsPageClient";

const WALLET = "GTESTWALLET111111111111111111111111111111111111111111111111";

function connect() {
  mockAddress = WALLET;
}

function disconnect() {
  mockAddress = null;
}

async function submit(user: ReturnType<typeof userEvent.setup>, name: string, why = "Plenty of demand for it here.") {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Why should Vortex support it?"), why);
  await user.click(screen.getByRole("button", { name: "Submit request" }));
}

describe("RequestsPageClient", () => {
  beforeEach(() => {
    resetSupportRequests();
    disconnect();
  });

  it("disables submit and upvote actions when disconnected", () => {
    render(<RequestsPageClient />);
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
    const upvoteButtons = screen.getAllByRole("button", { name: "Upvote" });
    expect(upvoteButtons.length).toBeGreaterThan(0);
    expect(upvoteButtons[0]).toBeDisabled();
  });

  it("adds a new request when connected", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await submit(user, "Cosmos", "Interoperability hub with lots of volume.");

    expect(screen.getByText("Cosmos")).toBeInTheDocument();
    expect(screen.getByText("Your request has been submitted.")).toBeInTheDocument();
  });

  it("shows already supported warning for existing chains", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await user.type(screen.getByLabelText("Name"), "Ethereum");
    expect(screen.getByText("This is already supported by Vortex.")).toBeInTheDocument();
  });

  it("points to existing request on duplicate submission and offers direct upvote", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await submit(user, "bnb chain", "We really want BNB chain on vortex.");

    expect(
      screen.getByText("This has already been requested — upvote the existing request instead."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upvote existing request" })).toBeInTheDocument();
  });

  describe("Sort controls", () => {
    it("renders sort selector with all three options and defaults to Most upvoted", () => {
      render(<RequestsPageClient />);
      const select = screen.getByLabelText("Sort requests by") as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe("upvotes");

      const options = within(select).getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent("Most upvoted");
      expect(options[1]).toHaveTextContent("Newest");
      expect(options[2]).toHaveTextContent("Name A–Z");

      // Default order: BNB Chain (2 upvotes) then DAI (1 upvote)
      const listItems = screen.getAllByRole("listitem");
      expect(within(listItems[0]!).getByText("BNB Chain")).toBeInTheDocument();
      expect(within(listItems[1]!).getByText("DAI")).toBeInTheDocument();
    });

    it("re-sorts requests when switching to 'Newest'", async () => {
      const user = userEvent.setup();
      render(<RequestsPageClient />);

      const select = screen.getByLabelText("Sort requests by");
      await user.selectOptions(select, "newest");

      // DAI (2026-08-22) is newer than BNB Chain (2026-08-20)
      const listItems = screen.getAllByRole("listitem");
      expect(within(listItems[0]!).getByText("DAI")).toBeInTheDocument();
      expect(within(listItems[1]!).getByText("BNB Chain")).toBeInTheDocument();
    });

    it("re-sorts requests when switching to 'Name A–Z'", async () => {
      connect();
      // Add Aptos so we have A, B, D
      submitSupportRequest(WALLET, {
        kind: "chain",
        name: "Aptos",
        justification: "Fast layer 1 network with growing Move ecosystem.",
      });

      const user = userEvent.setup();
      render(<RequestsPageClient />);

      const select = screen.getByLabelText("Sort requests by");
      await user.selectOptions(select, "name");

      const listItems = screen.getAllByRole("listitem");
      expect(within(listItems[0]!).getByText("Aptos")).toBeInTheDocument();
      expect(within(listItems[1]!).getByText("BNB Chain")).toBeInTheDocument();
      expect(within(listItems[2]!).getByText("DAI")).toBeInTheDocument();
    });

    it("correctly applies tie-breaker for 'upvotes' (older createdAt first)", () => {
      connect();
      // Submit a request that also has 1 upvote like DAI, but created later
      submitSupportRequest(WALLET, {
        kind: "token",
        name: "ZetaToken",
        justification: "Emerging cross chain token with high community interest.",
      });

      render(<RequestsPageClient />);

      const listItems = screen.getAllByRole("listitem");
      // BNB Chain has 2 upvotes (index 0)
      expect(within(listItems[0]!).getByText("BNB Chain")).toBeInTheDocument();
      // DAI was created 2026-08-22, ZetaToken created now; DAI is older so comes before ZetaToken
      expect(within(listItems[1]!).getByText("DAI")).toBeInTheDocument();
      expect(within(listItems[2]!).getByText("ZetaToken")).toBeInTheDocument();
    });

    it("correctly applies tie-breaker for 'newest' (name A-Z first on equal date)", async () => {
      connect();
      const user = userEvent.setup();
      render(<RequestsPageClient />);

      const select = screen.getByLabelText("Sort requests by");
      await user.selectOptions(select, "newest");

      const listItems = screen.getAllByRole("listitem");
      expect(within(listItems[0]!).getByText("DAI")).toBeInTheDocument();
      expect(within(listItems[1]!).getByText("BNB Chain")).toBeInTheDocument();
    });

    it("correctly applies tie-breaker for 'name' (higher upvotes first on equal name)", async () => {
      connect();
      const user = userEvent.setup();
      render(<RequestsPageClient />);

      const select = screen.getByLabelText("Sort requests by");
      await user.selectOptions(select, "name");

      // BNB Chain starts with 'B', DAI with 'D'
      const listItems = screen.getAllByRole("listitem");
      expect(within(listItems[0]!).getByText("BNB Chain")).toBeInTheDocument();
      expect(within(listItems[1]!).getByText("DAI")).toBeInTheDocument();
    });
  });
});
