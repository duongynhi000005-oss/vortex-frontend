import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCallNote, sortCallNotes, type CallNote } from "./callNotes";

export const CALLS_DIR = join(process.cwd(), "docs", "calls");

/** Reads every `docs/calls/*.md`, skipping unreadable or malformed files. */
export function loadCallNotes(dir: string = CALLS_DIR): CallNote[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const notes: CallNote[] = [];
  for (const file of files) {
    try {
      const note = parseCallNote(file.replace(/\.md$/, ""), readFileSync(join(dir, file), "utf8"));
      if (note) notes.push(note);
    } catch {
      /* skip unreadable file */
    }
  }
  return sortCallNotes(notes);
}
