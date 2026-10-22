export type BucketState = { tokens: number; updatedAt: number };

/** Storage layer behind the token bucket; swap to share state across instances. */
export interface RateLimitStore {
  get(key: string): BucketState | undefined;
  set(key: string, state: BucketState): void;
}

export function createMemoryStore(maxKeys = 10_000): RateLimitStore {
  const buckets = new Map<string, BucketState>();
  return {
    get: (key) => buckets.get(key),
    set(key, state) {
      if (!buckets.has(key) && buckets.size >= maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      buckets.set(key, state);
    },
  };
}

/**
 * Per-key token bucket. The default store is in-memory and therefore
 * per-instance: on a horizontally scaled deployment the effective burst is
 * `capacity * warmInstances`. Accepted tradeoff — see docs/security-audit.md
 * ("Rate limiting"); no shared backend (KV/Redis) is provisioned by the
 * project. Pass a shared `store` to enforce one combined limit.
 */
export function createTokenBucket(
  capacity: number,
  refillPerSecond: number,
  maxKeys = 10_000,
  store: RateLimitStore = createMemoryStore(maxKeys),
) {
  return function take(key: string, now: number = Date.now()): boolean {
    const prev = store.get(key) ?? { tokens: capacity, updatedAt: now };
    const elapsed = Math.max(0, now - prev.updatedAt) / 1000;
    const tokens = Math.min(capacity, prev.tokens + elapsed * refillPerSecond);
    const allowed = tokens >= 1;
    store.set(key, { tokens: allowed ? tokens - 1 : tokens, updatedAt: now });
    return allowed;
  };
}
