import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  encodeShareState,
  type AnalyticsShareState,
} from "./analyticsExport";

const STELLAR_PUBLIC_KEY = /G[A-Z2-7]{55}/;
const STELLAR_SECRET_KEY = /S[A-Z2-7]{55}/;
const XDR_PREFIX = /AAAA[A-Za-z0-9+/]{8,}/;

/** True when `s` looks like a Stellar public/secret key or a base64 XDR blob. */
function looksLikeStellarKeyOrXdr(s: string): boolean {
  return (
    STELLAR_PUBLIC_KEY.test(s) ||
    STELLAR_SECRET_KEY.test(s) ||
    XDR_PREFIX.test(s)
  );
}

const FIXTURES: AnalyticsShareState[] = [
  {},
  { from: "2025-01-01T00:00:00.000Z", to: "2025-12-31T23:59:59.999Z" },
  { chain: "stellar", token: "USDC" },
  {
    from: "2025-01-01",
    to: "2025-06-30",
    chain: "ethereum",
    token: "XLM",
  },
];

describe("analytics share URL privacy policy", () => {
  it.each(FIXTURES.map((f) => [JSON.stringify(f), f] as const))(
    "never carries wallet or XDR data: %s",
    (_label, state) => {
      const encoded = encodeShareState(state);
      const decodedJson = atob(encoded);
      const url = buildShareUrl(state);

      for (const [field, value] of Object.entries(JSON.parse(decodedJson))) {
        expect(
          looksLikeStellarKeyOrXdr(String(value)),
          `share-state field "${field}" looks like a Stellar key or XDR`,
        ).toBe(false);
      }
      expect(looksLikeStellarKeyOrXdr(encoded), "encoded share state").toBe(
        false,
      );
      expect(looksLikeStellarKeyOrXdr(decodedJson), "decoded share state").toBe(
        false,
      );
      expect(looksLikeStellarKeyOrXdr(url), "share URL").toBe(false);
    },
  );

  it("the guard detects wallet-shaped values", () => {
    const g = "G" + "A".repeat(55);
    const s = "S" + "B".repeat(55);
    expect(looksLikeStellarKeyOrXdr(g)).toBe(true);
    expect(looksLikeStellarKeyOrXdr(s)).toBe(true);
    expect(looksLikeStellarKeyOrXdr("AAAAAgAAAAC12345678")).toBe(true);
    expect(looksLikeStellarKeyOrXdr("USDC")).toBe(false);
  });
});
