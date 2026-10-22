import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "stellar-sdk";
import {
  SIGNATURE_WINDOW_MS,
  buildCanonicalMessage,
  hashCommentText,
  signComment,
  verifySignedComment,
} from "./signMessage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hashCommentText", () => {
  it("exercises crypto.subtle.digest and returns a sha256 hex digest", async () => {
    const spy = vi.spyOn(globalThis.crypto.subtle, "digest");
    const hash = await hashCommentText("hello");
    expect(spy).toHaveBeenCalledWith("SHA-256", expect.anything());
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("is deterministic and NFC/trim normalised", async () => {
    const a = await hashCommentText("  café ");
    const b = await hashCommentText("café");
    expect(a).toBe(b);
  });
});

describe("verifySignedComment", () => {
  const keypair = Keypair.random();
  const payload = { proposalId: "VIP-1", text: "hello", timestamp: 1_700_000_000_000 };

  it("accepts a fresh, valid signature", async () => {
    const signed = await signComment(keypair, payload);
    expect(await verifySignedComment(signed, payload.timestamp + 1000)).toBe(true);
  });

  it("rejects signatures outside the freshness window", async () => {
    const signed = await signComment(keypair, payload);
    const now = payload.timestamp + SIGNATURE_WINDOW_MS + 1;
    expect(await verifySignedComment(signed, now)).toBe(false);
  });

  it("rejects tampered text", async () => {
    const signed = await signComment(keypair, payload);
    expect(await verifySignedComment({ ...signed, text: "other" }, payload.timestamp)).toBe(false);
  });

  it("builds the canonical message", () => {
    expect(buildCanonicalMessage("VIP-1", "abc", 5)).toBe("stellar-comment:VIP-1:abc:5");
  });
});
