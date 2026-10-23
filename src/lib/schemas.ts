// Runtime parsers for relay responses and WebSocket frames. Generated from the contract
// snapshot (see docs/api-contract.md); re-exported so call sites import from one place.
export {
  parseFeedItem,
  parseIntentClosedEvent,
  parseIntentDetail,
  parseIntentEnvelope,
  parseIntentOpenEvent,
  parseIntentStatus,
  parseOpenIntent,
} from "./generated/relay";
