import type { GovernanceProposal } from "./governanceStore";
import type { Solver } from "./types";
import type { ParameterChange } from "./governanceStore";

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

/**
 * Shape every registry handler reports back, so proposal rendering does not
 * need to know which parameter produced it.
 */
export type ImpactResult = {
  direction: "raise" | "lower" | "unchanged";
  proposedValue: number;
  /** Solvers in the data set. */
  total: number;
  /** Solvers whose outcome gets worse under the proposed value. */
  wouldLose: number;
  /** Solvers whose outcome gets better under the proposed value. */
  wouldGain: number;
};

export type ParameterImpactHandler = (change: ParameterChange, solvers: readonly Solver[]) => ImpactResult;

function directionOf(currentValue: number, proposedValue: number): ImpactResult["direction"] {
  return proposedValue > currentValue ? "raise" : proposedValue < currentValue ? "lower" : "unchanged";
}

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
    direction: directionOf(currentValue, proposedValue),
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

/**
 * A solver fee change applies to every solver's estimated earnings at once, so
 * every solver in the set is affected in the same direction.
 */
export function simulateSolverFeeBps<T>(
  solvers: readonly T[],
  currentValue: number,
  proposedValue: number,
): ImpactResult {
  const direction = directionOf(currentValue, proposedValue);
  return {
    direction,
    proposedValue,
    total: solvers.length,
    wouldLose: direction === "lower" ? solvers.length : 0,
    wouldGain: direction === "raise" ? solvers.length : 0,
  };
}

/**
 * Automated impact previews keyed by `ParameterChange.parameter`. Adding a
 * parameter means adding an entry here; proposal rendering stays unchanged.
 * Parameters without an entry get no automated preview.
 */
export const PARAMETER_IMPACT_REGISTRY: Record<string, ParameterImpactHandler> = {
  minSolverBondUsd: (change, solvers) =>
    simulateBondThreshold(solvers, change.currentValue, change.proposedValue),
  solverFeeBps: (change, solvers) => simulateSolverFeeBps(solvers, change.currentValue, change.proposedValue),
};

/**
 * Looks up a handler by own property only, so names such as `constructor` or
 * `toString` inherited from Object.prototype do not resolve to a handler.
 */
export function getParameterImpactHandler(parameter: string): ParameterImpactHandler | undefined {
  return Object.prototype.hasOwnProperty.call(PARAMETER_IMPACT_REGISTRY, parameter)
    ? PARAMETER_IMPACT_REGISTRY[parameter]
    : undefined;
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
