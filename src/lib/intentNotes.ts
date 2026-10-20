import { storage, STORAGE_KEYS } from "@/lib/storage";

/**
 * Local-only notes and colour tags for the connected wallet's intents (#583).
 *
 * Stored per wallet address (`vortex:intent-notes:<address>`), so one account's
 * notes never show for another account on a shared device. Nothing is synced
 * to a backend. Pure helpers only: the UI owns when to read and write.
 */

export const MAX_NOTE_LENGTH = 500;
export const MAX_TAGS_PER_INTENT = 3;
export const INTENT_TAG_COLORS = ["sage", "amber", "rose", "sky", "violet"] as const;

const MAX_INTENT_ID_LENGTH = 128;

export type IntentTagColor = (typeof INTENT_TAG_COLORS)[number];
export type IntentNote = { note: string; tags: IntentTagColor[] };
export type IntentNotes = Record<string, IntentNote>;

/** Removes control and format characters (incl. bidi overrides); a note is one line of plain text. */
export function sanitizeNote(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, MAX_NOTE_LENGTH);
}

/** Keeps only known colour tags, de-duplicated and capped per intent. */
export function sanitizeTags(raw: unknown): IntentTagColor[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<unknown>(INTENT_TAG_COLORS);
  const tags = raw.filter((tag): tag is IntentTagColor => allowed.has(tag));
  return [...new Set(tags)].slice(0, MAX_TAGS_PER_INTENT);
}

/** Drops corrupted entries and empty annotations; re-validates every remaining entry. */
export function sanitizeIntentNotes(value: unknown): IntentNotes {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const clean: IntentNotes = {};
  for (const [intentId, entry] of Object.entries(value)) {
    if (intentId === "" || intentId.length > MAX_INTENT_ID_LENGTH) continue;
    if (typeof entry !== "object" || entry === null) continue;
    const { note, tags } = entry as Record<string, unknown>;
    const cleanNote = sanitizeNote(note);
    const cleanTags = sanitizeTags(tags);
    if (cleanNote === "" && cleanTags.length === 0) continue;
    clean[intentId] = { note: cleanNote, tags: cleanTags };
  }
  return clean;
}

export function intentNotesKey(address: string): string {
  return `${STORAGE_KEYS.intentNotes.key}${address}`;
}

/** Notes for one wallet. Returns `{}` when there is no wallet, nothing is stored, or the value is unreadable. */
export function readIntentNotes(address: string | null | undefined): IntentNotes {
  if (!address) return {};
  const raw = storage.getItem(intentNotesKey(address));
  if (raw === null) return {};
  try {
    return sanitizeIntentNotes(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeIntentNotes(address: string, notes: IntentNotes): void {
  if (!address) return;
  storage.setItem(intentNotesKey(address), JSON.stringify(sanitizeIntentNotes(notes)));
}

/** Returns a new map with `intentId` set to the sanitised draft, or removed when the draft is empty. */
export function setIntentNote(
  notes: IntentNotes,
  intentId: string,
  draft: { note: unknown; tags: unknown },
): IntentNotes {
  const next = { ...notes };
  const note = sanitizeNote(draft.note);
  const tags = sanitizeTags(draft.tags);
  if (note === "" && tags.length === 0) {
    delete next[intentId];
  } else {
    next[intentId] = { note, tags };
  }
  return sanitizeIntentNotes(next);
}
