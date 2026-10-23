"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useDismissableOverlay } from "@/hooks/useDismissableOverlay";
import { secureLogger } from "@/lib/secureLogging";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { downloadBlob, startExport, type ExportJob } from "@/lib/export/client";
import { useAnnounce } from "@/components/Announcer";
import {
  EXPORT_COLUMNS,
  applyFilenameTemplate,
  filterByDateRange,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export/serialize";
import { buildIntentsCsv } from "@/lib/csv";
import type { FeedItem } from "@/lib/types";

const NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

type Props = {
  /** The loaded (already filtered) list. The API is not paginated, so only loaded data is exported. */
  items: FeedItem[];
  filenameBase: string;
};

export function ExportDialog({ items, filenameBase }: Props) {
  const { t } = useTranslation();
  const announce = useAnnounce();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [columns, setColumns] = useState<ExportColumn[]>([...EXPORT_COLUMNS]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState(`${filenameBase}-{date}`);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<ExportJob | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDismissableOverlay<HTMLDivElement>({
    isOpen: open,
    onClose: () => setOpen(false),
    triggerRef,
  });
  const { copy, copied } = useCopyToClipboard();

  const rows = useMemo(() => filterByDateRange(items, from || undefined, to || undefined), [items, from, to]);
  const running = progress !== null;

  // Route progress updates through the shared Announcer (polite) per docs/accessibility.md.
  useEffect(() => {
    if (!progress) return;
    announce(t("export.progress", { done: String(progress.done), total: String(progress.total) }), {
      politeness: "polite",
      source: "export-progress",
    });
  }, [progress, announce, t]);

  // Route error messages through the shared Announcer (assertive) per docs/accessibility.md.
  useEffect(() => {
    if (!error) return;
    announce(error, { politeness: "assertive", source: "export-error" });
  }, [error, announce]);

  const toggleColumn = (col: ExportColumn) =>
    setColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : EXPORT_COLUMNS.filter((c) => c === col || prev.includes(c))));

  const run = async () => {
    setError(null);
    setProgress({ done: 0, total: rows.length });
    const now = new Date();
    const job = startExport(
      rows,
      { format, columns, meta: { network: NETWORK, generatedAt: now.toISOString() } },
      (done, total) => setProgress({ done, total }),
    );
    jobRef.current = job;
    try {
      const blob = await job.promise;
      if (blob) downloadBlob(applyFilenameTemplate(template, format, now, NETWORK), blob);
    } catch (e) {
      secureLogger.error("Intent export failed", e);
      setError(t("export.error"));
    } finally {
      jobRef.current = null;
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={`${id}-panel`}
          disabled={items.length === 0}
          className="px-3 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          {t("export.open")}
        </button>

        {open && (
          <div
            ref={panelRef}
            id={`${id}-panel`}
            role="dialog"
            aria-label={t("export.title")}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-vx-border bg-vx-card p-4 shadow-xl space-y-4 text-xs text-vx-muted motion-safe:animate-[sheet-up_180ms_ease-out] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)] sm:max-h-none sm:overflow-visible sm:rounded-xl sm:animate-none"
          >
            <fieldset>
              <legend className="font-medium mb-1">{t("export.format")}</legend>
              <div className="flex gap-4">
                {(["csv", "json"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1.5 uppercase">
                    <input type="radio" name={`${id}-format`} checked={format === f} onChange={() => setFormat(f)} />
                    {f}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-medium mb-1">{t("export.columns")}</legend>
              <div className="grid grid-cols-2 gap-1">
                {EXPORT_COLUMNS.map((col) => (
                  <label key={col} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={columns.includes(col)} onChange={() => toggleColumn(col)} />
                    {col}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                {t("export.from")}
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
              </label>
              <label className="flex flex-col gap-1">
                {t("export.to")}
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              {t("export.filename")}
              <input value={template} onChange={(e) => setTemplate(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
            </label>

            <p>{t("export.estimate", { count: String(rows.length) })}</p>
            <p className="text-vx-dim">{t("export.loadedOnly")}</p>

            {running && (
              <progress
                className="w-full"
                max={progress.total || 1}
                value={progress.done}
                aria-label={t("export.progress", { done: String(progress.done), total: String(progress.total) })}
              />
            )}
            {error && <p role="alert" className="text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              {running ? (
                <button type="button" onClick={() => jobRef.current?.cancel()} className="px-3 py-1.5 rounded-lg border border-vx-border hover:text-vx-text">
                  {t("export.cancel")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={run}
                  disabled={rows.length === 0 || columns.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-vx-sage/40 text-vx-sage font-semibold disabled:opacity-50"
                >
                  {t("export.start")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => copy(buildIntentsCsv(items))}
        disabled={items.length === 0}
        aria-label={t("export.copyCsv")}
        title={t("export.copyCsv")}
        className="inline-flex items-center gap-1 px-2 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {copied && <span>{t("export.copiedCsv")}</span>}
      </button>
    </div>
  );
}
