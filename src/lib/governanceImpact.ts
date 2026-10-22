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

/** Fields of a proposal that feed the quorum/approval calculation. */
export type ProposalTallyInput = {
  votesFor: number;
  votesAgainst: number;
  votesAbstain?: number;
  totalSupply?: number;
  quorumFraction?: number;
  approvalThreshold?: number;
  abstainCountsTowardQuorum?: boolean;
};

export type ProposalTally = {
  votesAbstain: number;
  /** Participation as a fraction of total supply (abstain counted only when configured). */
  turnoutFraction: number;
  quorumFraction: number;
  quorumMet: boolean;
  /** votesFor / (votesFor + votesAgainst); 0 when nobody has voted for or against. */
  approvalFraction: number;
  approvalThreshold: number;
  approvalMet: boolean;
};

const isPositive = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

const isFraction = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/**
 * Quorum, turnout and approval status for a proposal. Returns `null` when the
 * optional tally fields are missing or unusable (e.g. `totalSupply` of 0) so
 * callers hide the section instead of rendering NaN/Infinity.
 */
export function computeProposalTally(proposal: ProposalTallyInput): ProposalTally | null {
  const { totalSupply, quorumFraction, approvalThreshold } = proposal;
  if (!isPositive(totalSupply) || !isFraction(quorumFraction) || !isFraction(approvalThreshold)) {
    return null;
  }
  const votesAbstain = proposal.votesAbstain ?? 0;
  const counted =
    proposal.votesFor + proposal.votesAgainst + (proposal.abstainCountsTowardQuorum ? votesAbstain : 0);
  const turnoutFraction = counted / totalSupply;
  const decisive = proposal.votesFor + proposal.votesAgainst;
  const approvalFraction = decisive > 0 ? proposal.votesFor / decisive : 0;
  return {
    votesAbstain,
    turnoutFraction,
    quorumFraction,
    quorumMet: turnoutFraction >= quorumFraction,
    approvalFraction,
    approvalThreshold,
    approvalMet: decisive > 0 && approvalFraction >= approvalThreshold,
  };
}
