import { describe, expect, it } from "vitest";
import { governanceStore } from "./governanceStore";
import { toCsv } from "./csv";

describe("governanceStore archive and voter history", () => {
  it("lists proposals in archive shape", async () => {
    const list = await governanceStore.listProposals();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("tally.for");
  });

  it("returns deterministic voter history", async () => {
    const a = await governanceStore.getVoterHistory("GABC", { windowDays: 365 });
    const b = await governanceStore.getVoterHistory("GABC", { windowDays: 365 });
    expect(a).toEqual(b);
    expect(a.participationRate).toBeGreaterThanOrEqual(0);
    expect(a.participationRate).toBeLessThanOrEqual(1);
  });

  it("builds csv from rows", () => {
    expect(toCsv([{ a: "1", b: "x,y" }])).toBe('a,b\n1,"x,y"');
  });
});
