import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET as accountStatus } from "./account-status/route";
import { GET as federation } from "./federation/route";

vi.mock("@/lib/stellarAddress", () => ({ isValidStellarPublicKey: () => false }));

const accountReq = () =>
  new Request("http://x/api/account-status?address=bad", { headers: { "x-forwarded-for": "9.9.9.9" } }) as unknown as NextRequest;
const fedReq = () => new Request("http://x/api/federation?address=bad", { headers: { "x-forwarded-for": "9.9.9.9" } });

describe("route rate limits", () => {
  it("account-status returns 429 + Retry-After after the burst", async () => {
    const statuses: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) {
      last = await accountStatus(Object.assign(accountReq(), { nextUrl: new URL("http://x/api/account-status?address=bad") }));
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 400)).toBe(true);
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBe("2");
  });

  it("federation returns 429 + Retry-After after the burst", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await federation(fedReq());
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBe("10");
  });
});
