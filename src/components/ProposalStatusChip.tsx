import type { GovernanceProposalStatus } from "@/lib/governanceStore";

/** Single source of truth for the label/color of every proposal status. */
export const PROPOSAL_STATUS_CHIP: Record<GovernanceProposalStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-vx-sage-bg text-vx-sage border border-vx-sage/30" },
  passed: { label: "Passed", className: "bg-blue-500/10 text-blue-400 border border-blue-500/30" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-400 border border-red-500/30" },
  queued: { label: "Queued", className: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
  executed: { label: "Executed", className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
  expired: { label: "Expired", className: "bg-vx-surface text-vx-muted border border-vx-border" },
};

export function ProposalStatusChip({ status }: { status: GovernanceProposalStatus }) {
  const chip = PROPOSAL_STATUS_CHIP[status];
  return (
    <span
      data-status={status}
      className={`text-xs px-2.5 py-0.5 rounded-full font-medium w-fit ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}
