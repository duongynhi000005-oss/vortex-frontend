"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  BUILT_IN_VIEWS,
  MAX_VIEW_NAME_LENGTH,
  MAX_VIEWS,
  sanitizeViewParams,
  useViewsStore,
  viewParamsToSearch,
  type ViewParams,
  type ViewScope,
} from "@/store/views";

type SavedViewsProps = {
  scope: ViewScope;
  /** Current URL-state of the page (non-default params only). */
  currentParams: ViewParams;
  /** Applies a (validated) view's params to the page. */
  onApply: (params: ViewParams) => void;
};

const chipClass =
  "px-2.5 py-1 rounded-full border text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";
const iconBtnClass =
  "px-1.5 py-0.5 rounded text-xs text-vx-muted hover:text-vx-text disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

/**
 * Extracts the query string from a pasted URL or bare query string.
 * Returns null when the input cannot be parsed as a URL.
 */
function extractSearch(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare query string (with or without leading "?").
  if (trimmed.startsWith("?") || !trimmed.includes("://")) {
    const q = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
    // A bare query string must not contain a path/space; treat as search params.
    if (!q.includes(" ")) return q;
  }
  try {
    const url = new URL(trimmed, window.location.origin);
    return url.search.startsWith("?") ? url.search.slice(1) : url.search;
  } catch {
    return null;
  }
}

/**
 * Formats a timestamp as a short relative-time label (e.g. "just now", "5m ago").
 * Returns null when the timestamp is missing or invalid so callers can show "never".
 */
function formatRelativeTime(ts: number | undefined, now: number): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  const diffMs = now - ts;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Saved + built-in filter views with keyboard-operable rename/delete/reorder (#442). */
export function SavedViews({ scope, currentParams, onApply }: SavedViewsProps) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const allViews = useViewsStore((s) => s.views);
  const { saveView, renameView, deleteView, moveView, markViewUsed } = useViewsStore.getState();
  const views = allViews.filter((v) => v.scope === scope);
  const builtIns = BUILT_IN_VIEWS.filter((v) => v.scopes.includes(scope));

  const [draftName, setDraftName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");

  const currentSearch = viewParamsToSearch(currentParams);
  const isActive = (params: ViewParams) => viewParamsToSearch(params) === currentSearch;

  const apply = (params: ViewParams, viewId?: string) => {
    const { params: clean, degraded } = sanitizeViewParams(scope, params);
    setNotice(degraded ? t("views.notice.degraded") : null);
    if (viewId) markViewUsed(viewId);
    onApply(clean);
  };

  const share = async (params: ViewParams) => {
    const { params: clean } = sanitizeViewParams(scope, params);
    const url = `${window.location.origin}${window.location.pathname}${viewParamsToSearch(clean)}`;
    const ok = await copy(url);
    setNotice(ok ? t("views.notice.linkCopied") : t("views.notice.copyFailed"));
  };

  const submitSave = () => {
    if (draftName === null) return;
    const id = saveView(scope, draftName, currentParams);
    setNotice(id ? t("views.notice.saved") : t("views.notice.saveFailed", { max: MAX_VIEWS }));
    if (id) setDraftName(null);
  };

  const submitImport = () => {
    if (allViews.length >= MAX_VIEWS) {
      setNotice(t("views.notice.saveFailed", { max: MAX_VIEWS }));
      return;
    }
    const search = extractSearch(importUrl);
    if (search === null) {
      setNotice(t("views.notice.importInvalid"));
      return;
    }
    const raw: ViewParams = Object.fromEntries(new URLSearchParams(search).entries());
    const { params: clean, degraded } = sanitizeViewParams(scope, raw);
    const id = saveView(scope, importName, clean);
    if (!id) {
      setNotice(t("views.notice.saveFailed", { max: MAX_VIEWS }));
      return;
    }
    setNotice(degraded ? t("views.notice.degraded") : t("views.notice.imported"));
    setImportOpen(false);
    setImportUrl("");
    setImportName("");
  };

  const submitRename = () => {
    if (editingId) renameView(editingId, editName);
    setEditingId(null);
  };

  const now = Date.now();

  return (
    <section aria-label={t("views.title")} className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">{t("views.title")}</span>
        {builtIns.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={isActive(v.params)}
            onClick={() => apply(v.params)}
            className={`${chipClass} ${isActive(v.params) ? "border-vx-sage text-vx-text" : "border-vx-border text-vx-muted hover:text-vx-text"}`}
          >
            {t(v.nameKey)}
          </button>
        ))}
        {draftName === null ? (
          <button
            type="button"
            onClick={() => setDraftName("")}
            disabled={allViews.length >= MAX_VIEWS}
            className={`${chipClass} border-vx-sage/40 text-vx-sage disabled:opacity-40`}
          >
            {t("views.save")}
          </button>
        ) : (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitSave();
            }}
          >
            <label className="sr-only" htmlFor={`view-name-${scope}`}>
              {t("views.nameLabel")}
            </label>
            <input
              id={`view-name-${scope}`}
              autoFocus
              value={draftName}
              maxLength={MAX_VIEW_NAME_LENGTH}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraftName(null)}
              placeholder={t("views.nameLabel")}
              className="bg-vx-surface border border-vx-border rounded-lg px-2 py-1 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            />
            <button type="submit" className={iconBtnClass}>
              {t("views.confirm")}
            </button>
            <button type="button" onClick={() => setDraftName(null)} className={iconBtnClass}>
              {t("views.cancel")}
            </button>
          </form>
        )}
        {importOpen ? (
          <form
            className="flex flex-wrap items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitImport();
            }}
          >
            <label className="sr-only" htmlFor={`view-import-url-${scope}`}>
              {t("views.importUrlLabel")}
            </label>
            <input
              id={`view-import-url-${scope}`}
              autoFocus
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setImportOpen(false)}
              placeholder={t("views.importUrlPlaceholder")}
              className="bg-vx-surface border border-vx-border rounded-lg px-2 py-1 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            />
            <label className="sr-only" htmlFor={`view-import-name-${scope}`}>
              {t("views.nameLabel")}
            </label>
            <input
              id={`view-import-name-${scope}`}
              type="text"
              value={importName}
              maxLength={MAX_VIEW_NAME_LENGTH}
              onChange={(e) => setImportName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setImportOpen(false)}
              placeholder={t("views.nameLabel")}
              className="bg-vx-surface border border-vx-border rounded-lg px-2 py-1 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            />
            <button type="submit" className={iconBtnClass}>
              {t("views.confirm")}
            </button>
            <button type="button" onClick={() => setImportOpen(false)} className={iconBtnClass}>
              {t("views.cancel")}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={allViews.length >= MAX_VIEWS}
            className={`${chipClass} border-vx-border text-vx-muted hover:text-vx-text disabled:opacity-40`}
          >
            {t("views.import")}
          </button>
        )}
      </div>

      {views.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2">
          {views.map((v, i) => {
            const active = isActive(v.params);
            const lastUsed = formatRelativeTime(v.lastUsedAt, now);
            return (
              <li key={v.id} className="flex items-center gap-1">
                {editingId === v.id ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitRename();
                    }}
                  >
                    <label className="sr-only" htmlFor={`view-rename-${v.id}`}>
                      {t("views.nameLabel")}
                    </label>
                    <input
                      id={`view-rename-${v.id}`}
                      autoFocus
                      value={editName}
                      maxLength={MAX_VIEW_NAME_LENGTH}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                      className="bg-vx-surface border border-vx-border rounded-lg px-2 py-1 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                    />
                    <button type="submit" className={iconBtnClass}>
                      {t("views.confirm")}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={iconBtnClass}>
                      {t("views.cancel")}
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => apply(v.params, v.id)}
                      className={`${chipClass} ${active ? "border-vx-sage text-vx-text" : "border-vx-border text-vx-muted hover:text-vx-text"}`}
                    >
                      {v.name}
                    </button>
                    <span
                      className="text-[10px] text-vx-muted"
                      title={lastUsed ? t("views.lastUsed", { time: lastUsed }) : t("views.neverUsed")}
                    >
                      {lastUsed ?? t("views.neverUsed")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(v.id);
                        setEditName(v.name);
                      }}
                      className={iconBtnClass}
                      aria-label={t("views.rename")}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => share(v.params)}
                      className={iconBtnClass}
                      aria-label={t("views.share")}
                    >
                      ↗
                    </button>
                    <button
                      type="button"
                      onClick={() => moveView(v.id, -1)}
                      disabled={i === 0}
                      className={iconBtnClass}
                      aria-label={t("views.moveUp")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveView(v.id, 1)}
                      disabled={i === views.length - 1}
                      className={iconBtnClass}
                      aria-label={t("views.moveDown")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteView(v.id)}
                      className={iconBtnClass}
                      aria-label={t("views.delete")}
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <p role="status" className="text-xs text-vx-muted">
          {notice}
        </p>
      )}
    </section>
  );
}
