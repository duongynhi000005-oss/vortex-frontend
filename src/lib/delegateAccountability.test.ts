import { describe, expect, it } from 'vitest';
import { computeAccountabilityScore, type VoteHistoryEntry } from './delegateAccountability';

const NOW = Date.UTC(2026, 0, 1);
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;

function history(count: number, opts: { age?: number; aligned?: boolean } = {}): VoteHistoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: daysAgo(opts.age ?? i),
    choice: 'for',
    majorityChoice: opts.aligned === false ? 'against' : 'for',
  }));
}

describe('computeAccountabilityScore', () => {
  it('scores near 100 for perfect, recent, majority-aligned attendance', () => {
    const result = computeAccountabilityScore(
      { participationRate: 1, proposalsVoted: 10 },
      history(10, { age: 0 }),
      NOW,
    );
    expect(result).toEqual({ status: 'scored', score: 100 });
  });

  it('scores lower for sporadic, stale voting', () => {
    const result = computeAccountabilityScore(
      { participationRate: 0.2, proposalsVoted: 4 },
      history(4, { age: 400 }),
      NOW,
    );
    expect(result.status).toBe('scored');
    if (result.status === 'scored') expect(result.score).toBeLessThan(50);
  });

  it('lowers the score for always-minority voting', () => {
    const profile = { participationRate: 1, proposalsVoted: 10 };
    const aligned = computeAccountabilityScore(profile, history(10, { age: 0 }), NOW);
    const minority = computeAccountabilityScore(profile, history(10, { age: 0, aligned: false }), NOW);
    expect(aligned).toEqual({ status: 'scored', score: 100 });
    expect(minority).toEqual({ status: 'scored', score: 80 });
  });

  it('reports insufficient history for brand-new delegates', () => {
    expect(computeAccountabilityScore({ participationRate: 1, proposalsVoted: 0 }, [], NOW)).toEqual({
      status: 'insufficient',
      sampleSize: 0,
    });
    expect(
      computeAccountabilityScore({ participationRate: 1, proposalsVoted: 2 }, history(2), NOW).status,
    ).toBe('insufficient');
  });

  it('falls back to participation alone when no vote history is available', () => {
    expect(computeAccountabilityScore({ participationRate: 0.9, proposalsVoted: 50 }, [], NOW)).toEqual({
      status: 'scored',
      score: 90,
    });
  });

  it('ignores alignment when majority outcomes are unknown', () => {
    const votes = history(5, { age: 0 }).map(({ timestamp, choice }) => ({ timestamp, choice }));
    expect(
      computeAccountabilityScore({ participationRate: 1, proposalsVoted: 5 }, votes, NOW),
    ).toEqual({ status: 'scored', score: 100 });
  });
});
