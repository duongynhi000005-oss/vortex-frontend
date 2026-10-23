# Delegate accountability score

The accountability score is a single 0-100 signal shown as a badge in the delegate directory
(`/governance/delegates`) and the voter-history page header (`/governance/voter/[address]`). It sits
alongside the raw `participationRate` and `proposalsVoted` stats and does not replace them. It is
informational only and must never gate an on-chain action.

Implementation: `src/lib/delegateAccountability.ts` (`computeAccountabilityScore`), a pure function
with no fetching.

## Formula

Three components, each in the range 0-1:

| Component      | Weight | Definition |
| -------------- | ------ | ---------- |
| Participation  | 0.5    | The delegate's `participationRate`. |
| Activity       | 0.3    | Mean recency weight of the delegate's votes, where a vote of age `d` days weighs `0.5^(d / 90)` (90-day half-life). |
| Alignment      | 0.2    | Share of votes (with a known outcome) that match the winning choice. |

`score = round(100 * sum(weight_i * value_i) / sum(weight_i))`

Components that cannot be computed are dropped and the remaining weights are renormalised:

- No per-proposal vote history: only participation is used (the directory currently has no history).
- No votes with a known majority outcome: alignment is skipped.

## Insufficient history

If `max(vote history length, proposalsVoted) < 3`, no number is shown. The badge reads
"Insufficient history" so new delegates are neither flattered nor penalised.

## Limitations

Majority alignment is a descriptive signal, not a judgement: voting with a minority is legitimate.
It carries the lowest weight for that reason.
