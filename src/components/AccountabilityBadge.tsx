import { computeAccountabilityScore, type AccountabilityProfile, type VoteHistoryEntry } from '@/lib/delegateAccountability';

interface AccountabilityBadgeProps {
  profile: AccountabilityProfile;
  voteHistory?: readonly VoteHistoryEntry[];
}

export function AccountabilityBadge({ profile, voteHistory }: AccountabilityBadgeProps) {
  const result = computeAccountabilityScore(profile, voteHistory);
  const label =
    result.status === 'scored'
      ? `Accountability score: ${result.score} out of 100`
      : 'Accountability score: insufficient history';
  return (
    <span
      aria-label={label}
      title="Combines participation, recent activity and majority alignment. See docs/delegate-accountability.md."
      className="inline-block rounded-full border border-border px-2 py-0.5 text-xs font-medium"
    >
      {result.status === 'scored' ? `Accountability ${result.score}/100` : 'Insufficient history'}
    </span>
  );
}
