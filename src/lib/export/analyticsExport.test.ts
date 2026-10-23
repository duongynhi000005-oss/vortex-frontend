import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  encodeShareState,
  decodeShareState,
  readShareStateFromUrl,
  SHARE_PARAM,
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

describe("Analytics Share Link State Restoration (#601)", () => {
  const sampleState: AnalyticsShareState = {
    chain: "ethereum",
    token: "USDC",
    from: "2025-01-01",
    to: "2025-01-31",
  };

  it("round-trips state accurately through encodeShareState and decodeShareState", () => {
    const encoded = encodeShareState(sampleState);
    const decoded = decodeShareState(encoded);
    expect(decoded).toEqual(sampleState);
  });

  it("extracts and decodes share state from a relative query string via readShareStateFromUrl", () => {
    const encoded = encodeShareState(sampleState);
    const queryString = `?${SHARE_PARAM}=${encoded}`;

    const restored = readShareStateFromUrl(queryString);
    expect(restored).toEqual(sampleState);
  });

  it("extracts and decodes share state from a full URL string via readShareStateFromUrl", () => {
    const encoded = encodeShareState({ chain: "base", token: "WETH" });
    const fullUrl = `https://vortex.app/analytics?tab=overview&${SHARE_PARAM}=${encoded}#charts`;

    const restored = readShareStateFromUrl(fullUrl);
    expect(restored).toEqual({ chain: "base", token: "WETH" });
  });

  it("generates a shareable URL containing the encoded state via buildShareUrl", () => {
    const url = buildShareUrl(sampleState, "https://app.vortex.finance/analytics");
    expect(url).toContain(`${SHARE_PARAM}=`);

    const parsed = readShareStateFromUrl(url);
    expect(parsed).toEqual(sampleState);
  });

  it("returns null when the share parameter is missing or empty", () => {
    expect(readShareStateFromUrl("")).toBeNull();
    expect(readShareStateFromUrl("?foo=bar")).toBeNull();
    expect(readShareStateFromUrl(`?${SHARE_PARAM}=`)).toBeNull();
  });

  it("safely handles corrupted or tampered Base64 payloads without throwing", () => {
    expect(readShareStateFromUrl(`?${SHARE_PARAM}=not-valid-base64!@#$`)).toBeNull();
    expect(readShareStateFromUrl(`?${SHARE_PARAM}=${btoa("not-json")}`)).toBeNull();
    expect(readShareStateFromUrl(`?${SHARE_PARAM}=${btoa(JSON.stringify(["array-not-object"]))}`)).toBeNull();
  });

  it("rejects payloads with disallowed or unauthorized properties", () => {
    const maliciousJson = JSON.stringify({ c: "ethereum", maliciousProperty: "injected" });
    const encoded = btoa(maliciousJson);

    expect(readShareStateFromUrl(`?${SHARE_PARAM}=${encoded}`)).toBeNull();
  });

  it("rejects payloads attempting to leak Stellar addresses or private keys", () => {
    const leakedAddress = "G" + "A".repeat(55);
    const payload = JSON.stringify({ c: leakedAddress });
    const encoded = btoa(payload);

    // Should drop the invalid / sensitive value
    expect(readShareStateFromUrl(`?${SHARE_PARAM}=${encoded}`)).toEqual({});
  });
});
