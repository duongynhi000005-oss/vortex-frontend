import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCallNote, sortCallNotes } from "@/lib/callNotes";
import { loadCallNotes } from "@/lib/callNotes.server";

const note = (date: string, extra = "") => `---\ndate: ${date}\nsummary: S ${date}\n${extra}---\nBody`;

describe("call notes", () => {
  it("parses frontmatter, decisions and https-only recording links", () => {
    const n = parseCallNote("a", note("2026-10-01", "recording: https://x.test/r\ndecisions:\n  - one\n  - two\n"));
    expect(n).toMatchObject({ date: "2026-10-01", summary: "S 2026-10-01", recordingUrl: "https://x.test/r", decisions: ["one", "two"], body: "Body" });
    expect(parseCallNote("b", note("2026-10-01", "recording: javascript:alert(1)\n"))?.recordingUrl).toBeNull();
  });

  it("returns null for missing or malformed frontmatter", () => {
    expect(parseCallNote("a", "no frontmatter")).toBeNull();
    expect(parseCallNote("a", "---\nsummary: x\n---\nbody")).toBeNull();
    expect(parseCallNote("a", note("not-a-date"))).toBeNull();
  });

  it("sorts newest first and skips malformed files without crashing", () => {
    const dir = mkdtempSync(join(tmpdir(), "calls-"));
    writeFileSync(join(dir, "old.md"), note("2026-01-01"));
    writeFileSync(join(dir, "new.md"), note("2026-09-01"));
    writeFileSync(join(dir, "bad.md"), "---\nbroken");
    writeFileSync(join(dir, "ignore.txt"), "x");
    expect(loadCallNotes(dir).map((n) => n.slug)).toEqual(["new", "old"]);
    expect(loadCallNotes(join(dir, "missing"))).toEqual([]);
    expect(sortCallNotes([]).length).toBe(0);
  });
});
