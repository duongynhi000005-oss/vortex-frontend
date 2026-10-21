import { Nav } from "@/components/Nav";
import { ProposalDraftClient } from "./ProposalDraftClient";

export default function NewGovernanceProposalPage() {
  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="New governance proposal" />
      <main id="main-content" className="mx-auto max-w-3xl px-3 py-8 sm:px-5 sm:py-12">
        <h1 className="text-2xl font-bold text-vx-text sm:text-3xl">Draft a governance proposal</h1>
        <p className="mb-6 mt-2 max-w-2xl text-sm text-vx-muted">
          Review the proposal exactly as voters will see it before any wallet action.
        </p>
        <ProposalDraftClient />
      </main>
    </div>
  );
}
