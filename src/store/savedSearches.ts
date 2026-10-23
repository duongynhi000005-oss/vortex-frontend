import { create } from "zustand";
import { createSyncedPersist } from "@/lib/persist";
import { readQuery } from "@/lib/searchQuery";
import { sanitizeDisplayText } from "@/lib/textSafety";

/** Named, pinned `key:value` searches for IntentSearchBox (#578). Kept apart from unlabeled recents. */

export const SAVED_SEARCHES_KEY = "vortex-saved-searches";
export const SAVED_SEARCHES_VERSION = 0;
export const MAX_SAVED_SEARCHES = 10;
export const MAX_SAVED_SEARCH_LABEL_LENGTH = 40;

export type SavedSearch = { id: string; label: string; query: string };

function isSavedSearch(value: unknown): value is SavedSearch {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["label"] === "string" &&
    v["label"] !== "" &&
    typeof v["query"] === "string" &&
    v["query"] !== ""
  );
}

type PersistedSavedSearches = { searches: SavedSearch[] };

function isPersistedSavedSearches(value: unknown): value is PersistedSavedSearches {
  return (
    typeof value === "object" && value !== null && Array.isArray((value as Record<string, unknown>)["searches"])
  );
}

/** Drops corrupted entries and re-sanitises every label and query. */
export function sanitizeSavedSearches(value: PersistedSavedSearches): PersistedSavedSearches {
  const searches = (value.searches as unknown[])
    .filter(isSavedSearch)
    .slice(0, MAX_SAVED_SEARCHES)
    .map((s) => ({
      id: s.id,
      label: normalizeLabel(s.label),
      query: readQuery(s.query).trim(),
    }))
    .filter((s) => s.label && s.query);
  return { searches };
}

function normalizeLabel(raw: string): string {
  return sanitizeDisplayText(raw).replace(/\s+/g, " ").trim().slice(0, MAX_SAVED_SEARCH_LABEL_LENGTH);
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type SavedSearchesState = PersistedSavedSearches & {
  /** Returns the new id, or `null` when the label or query is empty, the query is already saved, or the limit is reached. */
  saveSearch: (label: string, query: string) => string | null;
  removeSearch: (id: string) => void;
};

export const useSavedSearchesStore = create<SavedSearchesState>()(
  createSyncedPersist(
    (set, get) => ({
      searches: [],
      saveSearch: (label, query) => {
        const searches = get().searches;
        const name = normalizeLabel(label);
        const clean = readQuery(query).trim();
        if (!name || !clean || searches.length >= MAX_SAVED_SEARCHES) return null;
        if (searches.some((s) => s.query === clean)) return null;
        const id = newId();
        set({ searches: [...searches, { id, label: name, query: clean }] });
        return id;
      },
      removeSearch: (id) => set({ searches: get().searches.filter((s) => s.id !== id) }),
    }),
    {
      name: SAVED_SEARCHES_KEY,
      version: SAVED_SEARCHES_VERSION,
      partialize: (state) => ({ searches: state.searches }),
      validate: isPersistedSavedSearches,
      sanitize: sanitizeSavedSearches,
    },
  ),
);
