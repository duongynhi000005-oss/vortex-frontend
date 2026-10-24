// Relay wire types, re-exported from the generated contract (see docs/api-contract.md).
// Do not add mirrored shapes here; extend spec/relay.openapi.json and run `npm run gen:api`.
export type {
  FeedItem,
  IntentClosedEvent,
  IntentDetail,
  IntentEnvelope,
  IntentOpenEvent,
  IntentStatus,
  OpenIntent,
} from "./generated/relay";

export type Solver = {
  name: string;
  address: string;
  bondUsd: number;
  fills: number;
  failed: number;
  volumeUsd: number;
  avgFillTimeSeconds: number;
  successRatePct: number;
  chains: string[];
  status: "active" | "inactive";
  /** Rank in the previous period for the requested window, when the relay provides it. */
  previousRank?: number;
  /** Relay-side verification flag (display only — never used for authorization). */
  verified?: boolean;
  /** Home domain claimed by the solver; verified client-side via stellar.toml. */
  homeDomain?: string;
};
