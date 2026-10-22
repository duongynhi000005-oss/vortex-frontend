import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

const hostname = vi.hoisted(() => ({ value: "app.test" }));
vi.mock("@/lib/config", () => ({
  getTrustedOrigins: () => [],
  evaluateOrigin: (h: string) => (h === "app.test" ? "trusted" : "untrusted"),
}));

vi.mock("@/lib/textSafety", () => ({ sanitizeDisplayText: (v: string) => v }));
vi.mock("@/store/wallet", () => ({ useWalletStore: { getState: () => ({}) } }));
const store = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/lib/storage", () => ({
  STORAGE_KEYS: { knownAddresses: { key: "known" } },
  storage: { getJSON: () => store.data, setJSON: (_k: string, v: unknown) => void (store.data = v) },
}));

import { checkOriginTrusted, UntrustedOriginError } from "@/lib/wallet/assertWalletReady";
import { getKnownAddressRecords, recordKnownAddress } from "@/lib/knownAddresses";
import { redactForExport } from "@/lib/intentExport";
import { decodeShareState, encodeShareState } from "@/lib/export/analyticsExport";

const ADDR = Keypair.random().publicKey();
const BLOB = "A".repeat(120);

beforeEach(() => {
  hostname.value = "app.test";
  store.data = undefined;
  vi.stubGlobal("window", { location: { get hostname() { return hostname.value; }, protocol: "https:" } });
});

describe("#645 origin re-check", () => {
  it("catches a mid-flow origin change", () => {
    expect(() => checkOriginTrusted()).not.toThrow();
    hostname.value = "evil.test";
    expect(() => checkOriginTrusted()).toThrow(UntrustedOriginError);
  });
});

describe("#646 known addresses", () => {
  it("rejects invalid addresses on write and drops them on read", () => {
    recordKnownAddress("not-an-address", "wallet");
    expect(getKnownAddressRecords()).toEqual([]);
    recordKnownAddress(ADDR, "wallet");
    expect(getKnownAddressRecords().map((e) => e.address)).toEqual([ADDR]);
  });
});

describe("#647 value-shape redaction", () => {
  it("redacts blob values under unrelated keys", () => {
    expect(redactForExport({ envelope: BLOB, memo: "hello" })).toEqual({ envelope: "[redacted]", memo: "hello" });
  });
});

describe("#648 analytics share state", () => {
  it("never encodes address/XDR-shaped values", () => {
    const out = atob(encodeShareState({ chain: ADDR, token: BLOB, from: "2026-01-01" }));
    expect(out).not.toContain(ADDR);
    expect(out).not.toContain(BLOB);
    expect(out).toContain("2026-01-01");
  });
  it("rejects oversized or unsafe input on decode", () => {
    expect(decodeShareState("A".repeat(2000))).toBeNull();
    expect(decodeShareState(btoa(JSON.stringify({ c: ADDR })))).toEqual({});
    expect(decodeShareState(btoa("[]"))).toBeNull();
  });
});
