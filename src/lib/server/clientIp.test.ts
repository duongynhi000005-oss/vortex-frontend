import { describe, expect, it } from "vitest";
import { clientIp } from "./clientIp";

const req = (xff?: string, ip?: string) =>
  ({ headers: new Headers(xff ? { "x-forwarded-for": xff } : {}), ip }) as Parameters<typeof clientIp>[0];

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => expect(clientIp(req("1.1.1.1, 2.2.2.2"))).toBe("1.1.1.1"));
  it("falls back to req.ip then unknown", () => {
    expect(clientIp(req(undefined, "3.3.3.3"))).toBe("3.3.3.3");
    expect(clientIp(req())).toBe("unknown");
  });
});
