import { describe, expect, it } from "vitest";
import { createMemoryStore, createTokenBucket } from "./rateLimit";

describe("createTokenBucket", () => {
  it("refills over time", () => {
    const take = createTokenBucket(1, 1);
    expect(take("a", 0)).toBe(true);
    expect(take("a", 0)).toBe(false);
    expect(take("a", 1000)).toBe(true);
  });

  it("enforces one combined limit across instances sharing a store", () => {
    const store = createMemoryStore();
    const a = createTokenBucket(2, 0, 10, store);
    const b = createTokenBucket(2, 0, 10, store);
    expect([a("k", 0), b("k", 0), a("k", 0)]).toEqual([true, true, false]);
    // Separate per-instance stores (today's default) would allow 4.
    const c = createTokenBucket(2, 0);
    const d = createTokenBucket(2, 0);
    expect([c("k", 0), d("k", 0), c("k", 0), d("k", 0)]).toEqual([true, true, true, true]);
  });
});
