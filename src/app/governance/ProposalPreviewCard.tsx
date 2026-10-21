"use client";

import type { GovernanceProposal } from "@/lib/governanceStore";
import { ProposalImpactPreview } from "./[id]/ProposalImpactPreview";

/** Shared proposal body used by both persisted proposals and authoring preview. */
export function ProposalPreviewCard({ proposal }: { proposal: GovernanceProposal }) {
  return (
    <article className="card p-5 sm:p-6 space-y-4" aria-label="Proposal preview">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-vx-sage">{proposal.id}</span>
        <span className="rounded-full border border-vx-border bg-vx-surface px-2 py-0.5 text-xs text-vx-muted">
          {proposal.category}
        </span>
        <span className="rounded-full border border-vx-sage/30 bg-vx-sage-bg px-2 py-0.5 text-xs text-vx-sage">
          {proposal.status}
        </span>
      </div>
      <h2 className="text-xl font-bold text-vx-text sm:text-2xl">{proposal.title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-vx-muted">
        {proposal.description}
      </p>
      <ProposalImpactPreview proposal={proposal} />
    </article>
  );
}
