import type { ExportColumn, ExportFormat } from "@/lib/export/serialize";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SavedExportConfig = {
  format: ExportFormat;
  columns: ExportColumn[];
  from: string;
  to: string;
  template: string;
  /** Epoch ms of the next reminder, or null when reminders are off. */
  remindAt: number | null;
};

const key = (scope: string) => `vortex-export-config-v1:${scope}`;

export function loadExportConfig(scope: string): SavedExportConfig | null {
  try {
    const raw = localStorage.getItem(key(scope));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedExportConfig>;
    if ((v.format !== "csv" && v.format !== "json") || !Array.isArray(v.columns) || typeof v.template !== "string") return null;
    return {
      format: v.format,
      columns: v.columns,
      from: typeof v.from === "string" ? v.from : "",
      to: typeof v.to === "string" ? v.to : "",
      template: v.template,
      remindAt: typeof v.remindAt === "number" ? v.remindAt : null,
    };
  } catch {
    return null;
  }
}

export function saveExportConfig(scope: string, config: SavedExportConfig): void {
  try {
    localStorage.setItem(key(scope), JSON.stringify(config));
  } catch {
    // Storage unavailable (private mode / quota) - the reminder is best-effort.
  }
}

export const isReminderDue = (remindAt: number | null, now: number): boolean => remindAt !== null && now >= remindAt;
