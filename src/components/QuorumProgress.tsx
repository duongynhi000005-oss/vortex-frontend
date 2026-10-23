import { computeQuorumProgress, type QuorumInputs } from "@/lib/governanceImpact";

/**
 * QuorumProgress — issue #585.
 *
 * Shows current participation against the quorum threshold and current
 * approval share against the approval threshold. Renders nothing when the
 * proposal lacks the fields needed for the calculation.
 */

type Props = {
  proposal: QuorumInputs;
};

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function ProgressMeter({
  label,
  valuePct,
  requiredPct,
  met,
  note,
}: {
  label: string;
  valuePct: number;
  requiredPct: number;
  met: boolean;
  note: string;
}) {
  const width = Math.min(100, Math.max(0, valuePct));
  const status = met ? "met" : "not met";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-xs text-vx-muted">
        <span>{label}</span>
        <span>
          <strong className={met ? "text-vx-sage" : "text-vx-amber"}>{pct(valuePct)}</strong>
          {" of "}
          {pct(requiredPct)} required
          <span className="ml-1 text-[10px] text-vx-dim">({status})</span>
        </span>
      </div>
      <div
        className="relative h-2.5 w-full rounded-full overflow-hidden bg-vx-surface"
        role="meter"
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${pct(valuePct)} of ${pct(requiredPct)} required, ${status}`}
      >
        <div
          className={`h-full transition-all duration-500 ${met ? "bg-vx-sage" : "bg-vx-amber"}`}
          style={{ width: `${width}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute top-0 h-full w-0.5 bg-vx-text"
          style={{ left: `calc(${Math.min(100, Math.max(0, requiredPct))}% - 1px)` }}
        />
      </div>
      <p className="text-[10px] text-vx-dim">{note}</p>
    </div>
  );
}

export function QuorumProgress({ proposal }: Props) {
  const progress = computeQuorumProgress(proposal);
  if (!progress) return null;

  const abstainNote = proposal.abstainCountsTowardQuorum
    ? "Includes abstain votes."
    : "Excludes abstain votes.";

  return (
    <section aria-labelledby="quorum-heading" className="pt-4 border-t border-vx-line space-y-4">
      <h3 id="quorum-heading" className="text-xs font-semibold text-vx-text">
        Quorum &amp; approval
      </h3>
      <ProgressMeter
        label="Quorum"
        valuePct={progress.participationPct}
        requiredPct={progress.quorumRequiredPct}
        met={progress.quorumMet}
        note={`Participation as a share of total supply. ${abstainNote}`}
      />
      <ProgressMeter
        label="Approval"
        valuePct={progress.approvalPct}
        requiredPct={progress.approvalRequiredPct}
        met={progress.approvalMet}
        note="For as a share of For + Against. Abstain is not counted."
      />
    </section>
  );
}
