/**
 * Delegate accountability score (0-100). Pure and independent of fetching so
 * it can be audited and tested against fixtures. Formula: docs/delegate-accountability.md.
 */

export const MIN_HISTORY_FOR_SCORE = 3;
export const RECENCY_HALF_LIFE_DAYS = 90;

export const ACCOUNTABILITY_WEIGHTS = {
  participation: 0.5,
  activity: 0.3,
  alignment: 0.2,
} as const;

export interface AccountabilityProfile {
  /** Fraction of eligible proposals voted on, 0-1. */
  participationRate: number;
  proposalsVoted: number;
}

export interface VoteHistoryEntry {
  timestamp: string | number | Date;
  choice: string;
  /** Winning choice of the proposal, when known. */
  majorityChoice?: string | null;
}

export type AccountabilityScore =
  | { status: 'scored'; score: number }
  | { status: 'insufficient'; sampleSize: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function computeAccountabilityScore(
  profile: AccountabilityProfile,
  voteHistory: readonly VoteHistoryEntry[] = [],
  now: number = Date.now(),
): AccountabilityScore {
  const sampleSize = Math.max(voteHistory.length, profile.proposalsVoted);
  if (sampleSize < MIN_HISTORY_FOR_SCORE) {
    return { status: 'insufficient', sampleSize };
  }

  const parts: { value: number; weight: number }[] = [
    { value: clamp01(profile.participationRate), weight: ACCOUNTABILITY_WEIGHTS.participation },
  ];

  if (voteHistory.length > 0) {
    const recency = voteHistory.map((vote) => {
      const time = new Date(vote.timestamp).getTime();
      if (Number.isNaN(time)) return 0;
      const ageDays = Math.max(0, (now - time) / DAY_MS);
      return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    });
    parts.push({
      value: recency.reduce((sum, r) => sum + r, 0) / recency.length,
      weight: ACCOUNTABILITY_WEIGHTS.activity,
    });

    const known = voteHistory.filter((vote) => vote.majorityChoice);
    if (known.length > 0) {
      const aligned = known.filter((vote) => vote.choice === vote.majorityChoice).length;
      parts.push({ value: aligned / known.length, weight: ACCOUNTABILITY_WEIGHTS.alignment });
    }
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
  return { status: 'scored', score: Math.round(weighted * 100) };
}
