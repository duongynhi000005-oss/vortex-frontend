import { describe, expect, it } from "vitest";
import { isConfusableAddress as fromHook } from "@/hooks/useDelegation";
import { isConfusableAddress } from "./stellarAddress";

const BASE = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";
// Same first 8 chars, different elsewhere (prefix-only match).
const PREFIX_ONLY = "GDW4UXK6" + "A".repeat(40) + "B".repeat(8);
// Same last 8 chars, different elsewhere (suffix-only match).
const SUFFIX_ONLY = "GCCCCCCC" + "D".repeat(40) + BASE.slice(-8);
const BOTH = BASE.slice(0, 8) + "E".repeat(40) + BASE.slice(-8);
const UNRELATED = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

describe("isConfusableAddress", () => {
  it("has real-length 56-char fixtures", () => {
    for (const a of [BASE, PREFIX_ONLY, SUFFIX_ONLY, BOTH, UNRELATED]) {
      expect(a).toHaveLength(56);
    }
  });

  it("flags shared prefix, shared suffix and both", () => {
    expect(isConfusableAddress(PREFIX_ONLY, BASE)).toBe(true);
    expect(isConfusableAddress(SUFFIX_ONLY, BASE)).toBe(true);
    expect(isConfusableAddress(BOTH, BASE)).toBe(true);
  });

  it("does not flag unrelated or identical addresses", () => {
    expect(isConfusableAddress(UNRELATED, BASE)).toBe(false);
    expect(isConfusableAddress(BASE, BASE)).toBe(false);
  });

  it("is the same function the delegation flow exposes", () => {
    expect(fromHook).toBe(isConfusableAddress);
  });
});
