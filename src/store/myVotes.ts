import { create } from "zustand";
import { createSyncedPersist } from "@/lib/persist";
import type { VoteChoice } from "@/hooks/useVote";

/**
 * Local record of votes cast through this app's own flow, scoped per wallet
 * address. This is not reconstructed from on-chain data.
 */
export const MY_VOTES_KEY = "vortex-my-votes";

export type VoteRecord = {
  proposalId: string;
  choice: VoteChoice;
  timestamp: number;
};

type PersistedMyVotes = { byWallet: Record<string, VoteRecord[]> };

type MyVotesState = PersistedMyVotes & {
  recordVote: (address: string, record: VoteRecord) => void;
};

const CHOICES: readonly VoteChoice[] = ["for", "against", "abstain"];

function isVoteRecord(value: unknown): value is VoteRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["proposalId"] === "string" &&
    CHOICES.includes(record["choice"] as VoteChoice) &&
    typeof record["timestamp"] === "number"
  );
}

function isPersistedMyVotes(value: unknown): value is PersistedMyVotes {
  if (typeof value !== "object" || value === null) return false;
  const byWallet = (value as Record<string, unknown>)["byWallet"];
  if (typeof byWallet !== "object" || byWallet === null || Array.isArray(byWallet)) return false;
  return Object.values(byWallet).every(
    (records) => Array.isArray(records) && records.every(isVoteRecord),
  );
}

export const useMyVotesStore = create<MyVotesState>()(
  createSyncedPersist(
    (set, get) => ({
      byWallet: {},
      recordVote: (address, record) => {
        const existing = get().byWallet[address] ?? [];
        // One entry per proposal: a changed vote replaces the earlier record.
        const rest = existing.filter((r) => r.proposalId !== record.proposalId);
        set({ byWallet: { ...get().byWallet, [address]: [record, ...rest] } });
      },
    }),
    {
      name: MY_VOTES_KEY,
      version: 0,
      partialize: (state) => ({ byWallet: state.byWallet }),
      validate: isPersistedMyVotes,
    },
  ),
);
