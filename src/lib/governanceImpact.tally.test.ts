import { describe, expect, it } from "vitest";
import { computeProposalTally } from "./governanceImpact";

describe("computeProposalTally", () => {
  it("computes VIP-1 style data (abstain counts toward quorum)", () => {
    const t = computeProposalTally({
      votesFor: 125000,
      votesAgainst: 42000,
      votesAbstain: 8000,
      totalSupply: 400000,
      quorumFraction: 0.4,
      approvalThreshold: 0.66,
      abstainCountsTowardQuorum: true,
    });
    expect(t?.turnoutFraction).toBeCloseTo(175000 / 400000);
    expect(t?.quorumMet).toBe(true);
    expect(t?.approvalFraction).toBeCloseTo(125000 / 167000);
    expect(t?.approvalMet).toBe(true);
  });

  it("excludes abstain from turnout when not configured", () => {
    const base = {
      votesFor: 100,
      votesAgainst: 100,
      votesAbstain: 100,
      totalSupply: 1000,
      quorumFraction: 0.25,
      approvalThreshold: 0.5,
    };
    expect(computeProposalTally({ ...base, abstainCountsTowardQuorum: false })?.quorumMet).toBe(false);
    expect(computeProposalTally({ ...base, abstainCountsTowardQuorum: true })?.quorumMet).toBe(true);
  });

  it("reports failing approval below threshold", () => {
    const t = computeProposalTally({
      votesFor: 50,
      votesAgainst: 50,
      totalSupply: 100,
      quorumFraction: 0.4,
      approvalThreshold: 0.66,
    });
    expect(t?.approvalMet).toBe(false);
    expect(t?.votesAbstain).toBe(0);
  });

  it("returns null when fields are missing or unusable", () => {
    expect(computeProposalTally({ votesFor: 1, votesAgainst: 1 })).toBeNull();
    expect(
      computeProposalTally({ votesFor: 1, votesAgainst: 1, totalSupply: 0, quorumFraction: 0.4, approvalThreshold: 0.5 }),
    ).toBeNull();
    expect(
      computeProposalTally({ votesFor: 1, votesAgainst: 1, totalSupply: 10, approvalThreshold: 0.5 }),
    ).toBeNull();
  });

  it("does not produce NaN when nobody voted", () => {
    const t = computeProposalTally({
      votesFor: 0,
      votesAgainst: 0,
      totalSupply: 10,
      quorumFraction: 0.4,
      approvalThreshold: 0.5,
    });
    expect(t?.approvalFraction).toBe(0);
    expect(t?.approvalMet).toBe(false);
  });
});
