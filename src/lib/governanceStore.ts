import { sanitizeText } from "./textSafety";

export type GovernanceProposalStatus =
  | "active"
  | "passed"
  | "rejected"
  | "queued"
  | "executed"
  | "expired";

/**
 * A proposal that changes one numeric protocol parameter. Only
 * `minSolverBondUsd` currently gets an automated impact preview (see
 * `src/lib/governanceImpact.ts`).
 */
export type ParameterChange = {
  parameter: "minSolverBondUsd" | (string & {});
  currentValue: number;
  proposedValue: number;
};

export type GovernanceProposal = {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: string;
  status: GovernanceProposalStatus;
  votesFor: number;
  votesAgainst: number;
  /** Votes that neither approve nor reject; counted toward quorum when configured. */
  votesAbstain?: number;
  /** Total voting power eligible to participate; used for quorum math. */
  totalSupply?: number;
  /** Minimum participation (as a fraction of totalSupply) required for quorum. */
  quorumFraction?: number;
  /** Minimum approval share (as a fraction of for+against) required to pass. */
  approvalThreshold?: number;
  /** Whether abstain votes count toward quorum (Governor-configurable). */
  abstainCountsTowardQuorum?: boolean;
  createdAt: string;
  deadline: string;
  /** When the proposal entered the timelock queue. */
  queuedAt?: string;
  /** When the timelock ends and execution becomes possible. */
  timelockEndsAt?: string;
  /** When the proposal was executed on-chain. */
  executedAt?: string;
  /** When the proposal expired without execution. */
  expiredAt?: string;
  parameterChange?: ParameterChange;
};

/**
 * Comment length bounds: single source of truth for the UI and the hooks.
 * Signing, hashing and verification (and the canonical message spec) live in
 * `src/lib/wallet/signMessage.ts`.
 */
export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 500;

export type CommentSignature = {
  /** Base64 signature produced by SEP-53 message signing (or the signMessage shim). */
  signature: string;
  /** Unix seconds covered by the signature. */
  timestamp: number;
  /** sha256 hex of the NFC-normalised comment text. */
  textHash: string;
  /** How the signature was produced. */
  scheme: "sep53" | "signMessage-shim";
};

export type ProposalComment = {
  id: string;
  proposalId: string;
  author: string;
  text: string;
  createdAt: string;
  signature?: CommentSignature;
  /** Set only after client-side verification succeeds. */
  verified?: boolean;
};

export type CommentPage = {
  comments: ProposalComment[];
  /** Cursor to pass back for the next (older) page, or null when exhausted. */
  nextCursor: string | null;
};

/**
 * PENDING_BACKEND_ENDPOINTS:
 * This mock store is a temporary in-memory placeholder for future real backend API endpoints:
 * - GET  /api/governance/proposals
 * - GET  /api/governance/proposals/:id
 * - GET  /api/governance/proposals/:id/comments?cursor=&limit=
 * - POST /api/governance/proposals/:id/comments
 */

const INITIAL_PROPOSALS: GovernanceProposal[] = [
  {
    id: "VIP-1",
    title: "Adjust Minimum Solver Bond Requirement from 50 to 100 USDC",
    description: "Proposal to increase the solver registration bond to strengthen economic security against unfulfilled intents and improve market stability.",
    proposer: "GAAX8890123456789012345678901234567890123456789012345678",
    category: "Protocol Parameters",
    status: "active",
    votesFor: 125000,
    votesAgainst: 42000,
    votesAbstain: 8000,
    totalSupply: 400000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-25T10:00:00Z",
    deadline: "2026-09-10T10:00:00Z",
    parameterChange: { parameter: "minSolverBondUsd", currentValue: 50, proposedValue: 100 },
  },
  {
    id: "VIP-2",
    title: "Add Direct Soroban Pool Liquidity Routing",
    description: "Enable routing for Soroban DEX pools to improve fill execution speed and reduce price impact for Stellar native cross-chain swaps.",
    proposer: "GBBY3456789012345678901234567890123456789012345678901234",
    category: "Routing & Architecture",
    status: "queued",
    votesFor: 450000,
    votesAgainst: 1200,
    votesAbstain: 3000,
    totalSupply: 600000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-15T14:30:00Z",
    deadline: "2026-08-28T14:30:00Z",
    queuedAt: "2026-08-28T15:00:00Z",
    timelockEndsAt: "2026-09-04T15:00:00Z",
  },
  {
    id: "VIP-3",
    title: "Implement Automated Solver Uptime Penalties",
    description: "Introduce automatic bond slashing for solvers missing more than 3 consecutive fill windows without taking inactive status.",
    proposer: "GCCZ1122334455667788990011223344556677889900112233445566",
    category: "Solver Network",
    status: "active",
    votesFor: 89000,
    votesAgainst: 64000,
    votesAbstain: 2000,
    totalSupply: 400000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-28T09:00:00Z",
    deadline: "2026-09-12T09:00:00Z",
  },
];

const INITIAL_COMMENTS: Record<string, ProposalComment[]> = {
  "VIP-1": [
    {
      id: "c-101",
      proposalId: "VIP-1",
      author: "GCZZ88912345678901234567890123456789012345678901234567890",
      text: "Increasing the bond to 100 USDC helps filter out low-reliability solvers while keeping entry barrier reasonable.",
      createdAt: "2026-08-26T11:15:00Z",
    },
    {
      id: "c-102",
      proposalId: "VIP-1",
      author: "GDKK9900112233445566778899001122334455667788990011223344",
      text: "Agree with the security rationale, but we should make sure smaller solvers have sufficient lead time to top up their bonds.",
      createdAt: "2026-08-27T09:40:00Z",
    },
  ],
  "VIP-2": [
    {
      id: "c-201",
      proposalId: "VIP-2",
      author: "GAAB1122334455667788990011223344556677889900112233445566",
      text: "Direct Soroban pool routing will significantly cut down average fill times on mainnet transactions.",
      createdAt: "2026-08-16T16:20:00Z",
    },
  ],
  "VIP-3": [
    {
      id: "c-301",
      proposalId: "VIP-3",
      author: "GEEE4455667788990011223344556677889900112233445566778899",
      text: "Uptime penalization is necessary to maintain fast user swap execution guarantees.",
      createdAt: "2026-08-29T14:10:00Z",
    },
  ],
};

let commentsStore: Record<string, ProposalComment[]> = { ...INITIAL_COMMENTS };

export function getGovernanceProposals(): GovernanceProposal[] {
  return INITIAL_PROPOSALS;
}

export function getGovernanceProposalById(id: string): GovernanceProposal | undefined {
  return INITIAL_PROPOSALS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/**
 * Cursor pagination over the comment thread. Comments are returned newest-first
 * and the cursor is the id of the last comment in the page.
 */
export function getProposalComments(
  proposalId: string,
  cursor?: string | null,
  limit = 20
): CommentPage {
  const all = commentsStore[proposalId] ? [...commentsStore[proposalId]] : [];
  const ordered = all.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const startIndex = cursor ? ordered.findIndex((c) => c.id === cursor) + 1 : 0;
  const slice = ordered.slice(startIndex, startIndex + limit);
  const last = slice[slice.length - 1];
  const hasMore = startIndex + limit < ordered.length;
  return {
    comments: slice,
    nextCursor: hasMore && last ? last.id : null,
  };
}

export type AddCommentInput = {
  proposalId: string;
  author: string;
  text: string;
  signature?: CommentSignature;
  verified?: boolean;
};

export function addProposalComment(input: AddCommentInput): ProposalComment {
  const sanitized = sanitizeText(input.text);
  const newComment: ProposalComment = {
    id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    proposalId: input.proposalId,
    author: input.author,
    text: sanitized,
    createdAt: new Date().toISOString(),
    signature: input.signature,
    verified: input.verified === true,
  };

  if (!commentsStore[input.proposalId]) {
    commentsStore[input.proposalId] = [];
  }
  commentsStore[input.proposalId].push(newComment);
  return newComment;
}

export function removeProposalComment(proposalId: string, commentId: string): void {
  const list = commentsStore[proposalId];
  if (!list) return;
  commentsStore[proposalId] = list.filter((c) => c.id !== commentId);
}
