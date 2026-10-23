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
