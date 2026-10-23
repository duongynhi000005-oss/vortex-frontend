/**
 * Seeded fixture generators. Output is deterministic for a given seed so that
 * Vitest snapshots, Playwright assertions and manual dev sessions all see the
 * same data. Timestamps are derived from a fixed epoch, never from `Date.now()`.
 */
import type { MockScenario } from "./scenarios";

export type MockIntentStatus = "open" | "pending" | "filled" | "failed";

export interface MockFeedItem {
  id: string;
  status: MockIntentStatus;
  sourceAsset: string;
  destAsset: string;
  sourceAmount: string;
  solver: string | null;
  createdAt: string;
}

export interface MockQuote {
  dstAmount: string;
  solver: string;
  fillTimeSeconds: number;
  priceImpactPct: number;
  protocolFeePct: number;
  rate: string;
}

export interface MockSolver {
  address: string;
  name: string;
  fillRatePct: number;
  slashEvents: number;
}

export interface MockDb {
  /** Public intent feed (`GET /intents/feed`). */
  feed: MockFeedItem[];
  /** Intents created in this session (`GET /intents`, `GET /intents/:id`). */
  intents: Map<string, MockFeedItem>;
}

export const MOCK_SOLVER_NAMES = [
  "Beta Liquidity Co",
  "Alpha Fill",
  "Gamma Routing",
  "Delta Market Maker",
] as const;

const ASSETS = ["USDC", "XLM", "EURC", "BTC"] as const;
const STATUSES: MockIntentStatus[] = ["open", "pending", "filled", "failed"];
const EPOCH_MS = Date.UTC(2026, 0, 1);
const FEED_SEED = 514;

/** mulberry32: small, fast, seedable PRNG. Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] as T;
}

export function createFeedItem(index: number, rng: () => number): MockFeedItem {
  const sourceAsset = pick(ASSETS, rng);
  const destAsset = pick(
    ASSETS.filter((asset) => asset !== sourceAsset),
    rng,
  );
  const status = pick(STATUSES, rng);
  return {
    id: `feed-${index + 1}`,
    status,
    sourceAsset,
    destAsset,
    sourceAmount: (Math.floor(rng() * 100_000) / 100).toFixed(2),
    solver: status === "open" ? null : pick(MOCK_SOLVER_NAMES, rng),
    createdAt: new Date(EPOCH_MS + index * 60_000).toISOString(),
  };
}

export function createFeed(count: number, seed: number = FEED_SEED): MockFeedItem[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, index) => createFeedItem(index, rng));
}

export function createMockDb(scenario: MockScenario): MockDb {
  return { feed: createFeed(scenario.feedCount), intents: new Map() };
}

/** Quote fixture matching the shape the swap form renders. */
export function createQuote(): MockQuote {
  return {
    dstAmount: "497.1234",
    solver: "Beta Liquidity Co",
    fillTimeSeconds: 32,
    priceImpactPct: 0.12,
    protocolFeePct: 0.05,
    rate: "1 USDC = 8.4600 XLM",
  };
}

/** Deterministic solver profile derived from its address. */
export function createSolver(address: string): MockSolver {
  const rng = createRng(seedFromString(address));
  return {
    address,
    name: pick(MOCK_SOLVER_NAMES, rng),
    fillRatePct: Math.round(80 + rng() * 20),
    slashEvents: Math.floor(rng() * 3),
  };
}
