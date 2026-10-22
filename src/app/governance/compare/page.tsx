import Link from "next/link";
import { notFound } from "next/navigation";
import { getGovernanceProposalById, getGovernanceProposals } from "@/lib/governanceStore";
import type { GovernanceProposal } from "@/lib/governanceStore";
import { ProposalStatusChip } from "@/components/ProposalStatusChip";
import { BondImpact } from "../[id]/ProposalImpactPreview";
import { sanitizeText } from "@/lib/textSafety";

interface ComparePageProps {
  searchParams?: { a?: string; b?: string };
}

function ProposalColumn({ proposal, showImpact }: { proposal: GovernanceProposal; showImpact: boolean }) {
  const change = proposal.parameterChange;
  return (
    <section className="card p-5 space-y-3" aria-label={proposal.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/governance/${proposal.id}`} className="font-mono text-xs font-bold text-vx-sage hover:underline">
          {proposal.id}
        </Link>
        <ProposalStatusChip status={proposal.status} />
      </div>
      <h2 className="text-base font-semibold text-vx-text">{sanitizeText(proposal.title)}</h2>
      <dl className="grid grid-cols-2 gap-2 text-xs text-vx-muted">
        <dt>Category</dt>
        <dd className="text-vx-text">{proposal.category}</dd>
        <dt>Votes for</dt>
        <dd className="text-vx-text">{proposal.votesFor.toLocaleString()}</dd>
        <dt>Votes against</dt>
        <dd className="text-vx-text">{proposal.votesAgainst.toLocaleString()}</dd>
        <dt>Votes abstain</dt>
        <dd className="text-vx-text">{(proposal.votesAbstain ?? 0).toLocaleString()}</dd>
        <dt>Parameter change</dt>
        <dd className="text-vx-text">
          {change ? `${change.parameter}: ${change.currentValue} → ${change.proposedValue}` : "None"}
        </dd>
      </dl>
      {showImpact && change && (
        <div className="pt-3 border-t border-vx-line space-y-1.5">
          <h3 className="text-xs font-semibold text-vx-text">Projected solver impact</h3>
          <BondImpact currentValue={change.currentValue} proposedValue={change.proposedValue} />
        </div>
      )}
    </section>
  );
}

export default function GovernanceComparePage({ searchParams }: ComparePageProps) {
  const aId = searchParams?.a;
  const bId = searchParams?.b;

  const a = aId ? getGovernanceProposalById(aId) : undefined;
  if (aId && !a) notFound();
  const b = bId ? getGovernanceProposalById(bId) : undefined;
  if (bId && !b) notFound();

  if (!a || !b) {
    const proposals = getGovernanceProposals();
    return (
      <main className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-4">
        <h1 className="text-2xl font-bold text-vx-text">Compare proposals</h1>
        <form action="/governance/compare" method="get" className="flex flex-wrap items-end gap-3 text-sm">
          {(["a", "b"] as const).map((name) => (
            <label key={name} className="flex flex-col gap-1">
              {name === "a" ? "First proposal" : "Second proposal"}
              <select name={name} defaultValue={name === "a" ? a?.id : b?.id} className="rounded border px-2 py-1">
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}: {p.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="submit" className="rounded border px-3 py-2 text-sm">
            Compare
          </button>
        </form>
      </main>
    );
  }

  const sameParam =
    a.id !== b.id &&
    a.parameterChange?.parameter === "minSolverBondUsd" &&
    b.parameterChange?.parameter === "minSolverBondUsd";

  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-6">
      <Link href="/governance" className="text-xs text-vx-sage hover:underline font-semibold">
        ← Back to Proposals
      </Link>
      <h1 className="text-2xl font-bold text-vx-text">
        Compare {a.id} and {b.id}
      </h1>
      {a.id === b.id && (
        <p role="status" className="text-xs text-vx-muted">
          Both selections are the same proposal.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <ProposalColumn proposal={a} showImpact={sameParam} />
        <ProposalColumn proposal={b} showImpact={sameParam} />
      </div>
      {!sameParam && (
        <p className="text-xs text-vx-muted">
          An impact comparison is not available: the proposals do not share a comparable parameter change, so only
          tallies and metadata are shown.
        </p>
      )}
    </main>
  );
}
