/**
 * Community call notes: static markdown files in `docs/calls/*.md` with a small
 * frontmatter block. Parsing is defensive; a malformed file is skipped (or
 * partially read) and never throws, so one bad note cannot break the page.
 *
 *   ---
 *   date: 2026-10-01
 *   summary: One-line summary
 *   recording: https://example.com/recording   (optional, https only)
 *   decisions:                                  (optional)
 *     - First decision
 *   ---
 *   Markdown body (rendered with the safe <Markdown> component).
 */

export interface CallNote {
  slug: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  summary: string;
  recordingUrl: string | null;
  decisions: string[];
  body: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCallNote(slug: string, raw: string): CallNote | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return null;
  const front = match[1] ?? "";
  const body = (match[2] ?? "").trim();

  const fields: Record<string, string> = {};
  const decisions: string[] = [];
  let inDecisions = false;
  for (const line of front.split(/\r?\n/)) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && inDecisions) {
      decisions.push(item[1]!.trim());
      continue;
    }
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    inDecisions = kv[1] === "decisions";
    if (!inDecisions) fields[kv[1]!] = kv[2]!.trim();
  }

  const date = fields["date"] ?? "";
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return null;

  const recording = fields["recording"] ?? "";
  return {
    slug,
    date,
    summary: fields["summary"] ?? "",
    recordingUrl: /^https:\/\/\S+$/.test(recording) ? recording : null,
    decisions,
    body,
  };
}

/** Newest first; ties broken by slug for a stable order. */
export function sortCallNotes(notes: CallNote[]): CallNote[] {
  return [...notes].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
