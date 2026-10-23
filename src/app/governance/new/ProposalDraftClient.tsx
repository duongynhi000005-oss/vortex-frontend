"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft";
import type { GovernanceProposal } from "@/lib/governanceStore";
import { sanitizeText } from "@/lib/textSafety";
import { ProposalPreviewCard } from "../ProposalPreviewCard";

type Draft = {
  title: string;
  description: string;
  category: string;
  includeBondChange: boolean;
  currentBond: string;
  proposedBond: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  category: "Protocol Parameters",
  includeBondChange: false,
  currentBond: "",
  proposedBond: "",
};

export function ProposalDraftClient() {
  const [savedDraft, saveDraft, clearDraft] = useLocalStorageDraft<Draft>(
    "vortex:governance-proposal-draft",
    null,
  );
  const [draft, setDraft] = useState<Draft>(savedDraft ?? EMPTY_DRAFT);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => saveDraft(draft), [draft, saveDraft]);

  const proposal = useMemo<GovernanceProposal>(() => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const currentValue = Number(draft.currentBond);
    const proposedValue = Number(draft.proposedBond);
    return {
      id: "DRAFT",
      title: sanitizeText(draft.title),
      description: sanitizeText(draft.description),
      category: sanitizeText(draft.category),
      proposer: "Connected wallet",
      status: "active",
      votesFor: 0,
      votesAgainst: 0,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
      ...(draft.includeBondChange && Number.isFinite(currentValue) && Number.isFinite(proposedValue)
        ? { parameterChange: { parameter: "minSolverBondUsd", currentValue, proposedValue } }
        : {}),
    };
  }, [draft]);

  const valid = proposal.title.length > 0 && proposal.description.length > 0 && proposal.category.length > 0
    && (!draft.includeBondChange || (Number(draft.currentBond) >= 0 && Number(draft.proposedBond) >= 0));

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreviewing(false);
  }

  if (previewing) {
    return (
      <div className="space-y-5">
        <ProposalPreviewCard proposal={proposal} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-lg border border-vx-border px-4 py-2 text-sm text-vx-text" onClick={() => setPreviewing(false)}>
            Edit draft
          </button>
          <button type="button" disabled className="rounded-lg bg-vx-sage px-4 py-2 text-sm font-semibold text-vx-ink opacity-50">
            Sign and submit
          </button>
        </div>
        <p role="status" className="text-xs text-vx-muted">
          On-chain proposal submission is not available yet. Your draft remains saved on this device.
        </p>
      </div>
    );
  }

  return (
    <form className="card space-y-5 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); if (valid) setPreviewing(true); }}>
      <label className="block space-y-2 text-sm text-vx-text">
        <span className="font-semibold">Title</span>
        <input required value={draft.title} onChange={(event) => update("title", event.target.value)} className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2" />
      </label>
      <label className="block space-y-2 text-sm text-vx-text">
        <span className="font-semibold">Description</span>
        <textarea required rows={6} value={draft.description} onChange={(event) => update("description", event.target.value)} className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2" />
      </label>
      <label className="block space-y-2 text-sm text-vx-text">
        <span className="font-semibold">Category</span>
        <input required value={draft.category} onChange={(event) => update("category", event.target.value)} className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm text-vx-text">
        <input type="checkbox" checked={draft.includeBondChange} onChange={(event) => update("includeBondChange", event.target.checked)} />
        Change the minimum solver bond
      </label>
      {draft.includeBondChange && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-vx-text"><span>Current bond (USD)</span><input type="number" min="0" required value={draft.currentBond} onChange={(event) => update("currentBond", event.target.value)} className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2" /></label>
          <label className="space-y-2 text-sm text-vx-text"><span>Proposed bond (USD)</span><input type="number" min="0" required value={draft.proposedBond} onChange={(event) => update("proposedBond", event.target.value)} className="w-full rounded-lg border border-vx-border bg-vx-surface px-3 py-2" /></label>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={!valid} className="rounded-lg bg-vx-sage px-4 py-2 text-sm font-semibold text-vx-ink disabled:opacity-50">Preview proposal</button>
        <button type="button" className="rounded-lg border border-vx-border px-4 py-2 text-sm text-vx-muted" onClick={() => { setDraft(EMPTY_DRAFT); clearDraft(); }}>Clear draft</button>
      </div>
    </form>
  );
}
