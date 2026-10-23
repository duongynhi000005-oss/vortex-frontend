import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TransactionReviewModal,
  findIntentMismatches,
} from "./TransactionReviewModal";
import type { ReviewModel } from "@/lib/xdrReview";

const DEST = "GDESTINATIONACCOUNT";
const review = (amount: string, destination = DEST, asset = "USDC") =>
  ({
    networkPassphrase: "Test SDF Network ; September 2015",
    sourceAccount: "GSOURCE",
    fee: "100",
    operationCount: 1,
    operations: [{ kind: "payment", amount, asset, destination }],
    unknownOperation: false,
  }) as unknown as ReviewModel;

const expected = { amount: "10.5", asset: "USDC", destination: DEST };

describe("findIntentMismatches", () => {
  it("passes a matching payment, ignoring decimal-precision differences", () => {
    expect(findIntentMismatches(review("10.5000000"), expected)).toEqual([]);
  });
  it("flags tampered amount, destination, or asset", () => {
    expect(findIntentMismatches(review("100.5"), expected)).toEqual([0]);
    expect(findIntentMismatches(review("10.5", "GATTACKER"), expected)).toEqual(
      [0],
    );
    expect(
      findIntentMismatches(review("10.5", DEST, "XLM (native)"), expected),
    ).toEqual([0]);
  });
  it("matches native asset regardless of label suffix", () => {
    expect(
      findIntentMismatches(review("1", DEST, "XLM (native)"), { asset: "XLM" }),
    ).toEqual([]);
  });
});

describe("TransactionReviewModal intent check", () => {
  const props = { open: true, onConfirm: vi.fn(), onCancel: vi.fn(), expected };

  it("allows confirming a matching transaction without acknowledgment", () => {
    render(<TransactionReviewModal {...props} review={review("10.5")} />);
    expect(
      screen.getByRole("button", { name: "Confirm and sign" }),
    ).toBeEnabled();
  });

  it("requires explicit acknowledgment for a mismatched transaction", () => {
    render(<TransactionReviewModal {...props} review={review("999")} />);
    const confirm = screen.getByRole("button", { name: "Confirm and sign" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Does not match what you requested",
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });
});
