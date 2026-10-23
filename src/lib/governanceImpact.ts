import type { GovernanceProposal } from "./governanceStore";
import type { Solver } from "./types";

/**
 * Concrete effect of changing the minimum solver bond, simulated against the
 * current solver set. Kept pure (no fetching, no rendering) so it can be
 * tested against fixtures.
 */
export type BondThresholdImpact = {
  direction: "raise" | "lower" | "unchanged";
  proposedValue: number;
  /** Solvers in the data set. */
  total: number;
  /** Solvers whose bond meets the proposed minimum. */
  qualifyAfter: number;
  /** Solvers that meet the current minimum but not the proposed one. */
  wouldLose: number;
  /** Solvers below the current minimum that the proposed one would admit. */
  wouldGain: number;
};

export function simulateBondThreshold(
  solvers: readonly Pick<Solver, "bondUsd">[],
  currentValue: number,
  proposedValue: number,
): BondThresholdImpact {
  const meets = (bond: number, threshold: number) => bond >= threshold;
  let qualifyAfter = 0;
  let wouldLose = 0;
  let wouldGain = 0;
  for (const { bondUsd } of solvers) {
    const now = meets(bondUsd, currentValue);
    const after = meets(bondUsd, proposedValue);
    if (after) qualifyAfter += 1;
    if (now && !after) wouldLose += 1;
    if (!now && after) wouldGain += 1;
  }
  return {
    direction:
      proposedValue > currentValue ? "raise" : proposedValue < currentValue ? "lower" : "unchanged",
    proposedValue,
    total: solvers.length,
    qualifyAfter,
    wouldLose,
    wouldGain,
  };
}

/** Vote fields needed to measure a proposal against its quorum and approval thresholds. */
export type QuorumInputs = Pick<
  GovernanceProposal,
  | "votesFor"
  | "votesAgainst"
  | "votesAbstain"
  | "totalSupply"
  | "quorumFraction"
  | "approvalThreshold"
  | "abstainCountsTowardQuorum"
>;

/**
 * Current standing of a proposal against its quorum and approval thresholds.
 * Percentages are 0–100 and unrounded. This is a snapshot of the tally, not a
 * projection of the final outcome.
 */
export type QuorumProgress = {
  /** Participating votes as a share of totalSupply. */
  participationPct: number;
  quorumRequiredPct: number;
  quorumMet: boolean;
  /** For votes as a share of for + against. Abstain never counts toward approval. */
  approvalPct: number;
  approvalRequiredPct: number;
  approvalMet: boolean;
};

/**
 * Returns null when the proposal does not carry the fields needed for quorum
 * math (totalSupply, quorumFraction, approvalThreshold).
 */
export function computeQuorumProgress(proposal: QuorumInputs): QuorumProgress | null {
  const { totalSupply, quorumFraction, approvalThreshold } = proposal;
  if (!totalSupply || totalSupply <= 0) return null;
  if (quorumFraction === undefined || approvalThreshold === undefined) return null;

  const abstain = proposal.abstainCountsTowardQuorum ? (proposal.votesAbstain ?? 0) : 0;
  const participating = proposal.votesFor + proposal.votesAgainst + abstain;
  const decisive = proposal.votesFor + proposal.votesAgainst;

  return {
    participationPct: (participating / totalSupply) * 100,
    quorumRequiredPct: quorumFraction * 100,
    // Compare as ratios rather than multiplying the threshold, to avoid float drift at the boundary.
    quorumMet: participating / totalSupply >= quorumFraction,
    approvalPct: decisive > 0 ? (proposal.votesFor / decisive) * 100 : 0,
    approvalRequiredPct: approvalThreshold * 100,
    approvalMet: decisive > 0 && proposal.votesFor / decisive >= approvalThreshold,
  };
}
