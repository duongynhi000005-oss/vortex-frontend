import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mockSearchParams = vi.hoisted(() => ({
  params: new Map<string, string>(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.params.get(key) ?? null,
  }),
}));

vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

const mockBond = {
  address: "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB",
  bond: "20",
  locked: "0",
  available: "20",
  minimumBond: "50",
  cooldownSeconds: 60,
  pendingWithdrawals: [],
};

vi.mock("@/store/wallet", () => ({
  useWalletStore: (sel: (s: { address: string; networkMismatch: boolean; connect: () => void }) => unknown) =>
    sel({
      address: "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB",
      networkMismatch: false,
      connect: vi.fn(),
    }),
}));

vi.mock("@/hooks/useBondManagement", () => ({
  useBondManagement: () => ({
    bond: mockBond,
    status: "idle",
    loadError: false,
    error: null,
    topUp: vi.fn().mockResolvedValue(true),
    requestWithdrawal: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/hooks/useLiveRelativeTime", () => ({
  useLiveRelativeTime: () => 1700000000000,
}));

import BondManagePageClient from "./BondManagePageClient";

describe("BondManagePageClient", () => {
  beforeEach(() => {
    mockSearchParams.params.clear();
  });

  it("pre-fills top-up amount input when topUp query param is present", () => {
    mockSearchParams.params.set("topUp", "30");
    const { container } = render(<BondManagePageClient />);

    const topUpInput = container.querySelector<HTMLInputElement>("#bond-top-up");
    expect(topUpInput).toBeTruthy();
    expect(topUpInput?.value).toBe("30");
  });

  it("pre-fills top-up amount from shortfall alias when topUp is absent", () => {
    mockSearchParams.params.set("shortfall", "25");
    const { container } = render(<BondManagePageClient />);

    const topUpInput = container.querySelector<HTMLInputElement>("#bond-top-up");
    expect(topUpInput?.value).toBe("25");
  });

  it("leaves top-up amount empty when no query param is present", () => {
    const { container } = render(<BondManagePageClient />);

    const topUpInput = container.querySelector<HTMLInputElement>("#bond-top-up");
    expect(topUpInput?.value).toBe("");
  });
});
