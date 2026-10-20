"use client";

import type { ReactNode } from "react";
import IntentStatusBadge, { type IntentStatus } from "@/components/IntentStatusBadge";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

/** Upper bound on side-by-side columns; keeps the comparison usable at ~400 px. */
export const MAX_COMPARE_INTENTS = 4;

const BADGE_STATUS: Record<string, IntentStatus> = {
  pending: "pending",
  processing: "processing",
  filled: "success",
  success: "success",
  failed: "error",
  error: "error",
  cancelled: "cancelled",
};

/** Maps a feed status onto the badge's status palette; unknown statuses read as pending. */
export function toBadgeStatus(status: string): IntentStatus {
  return BADGE_STATUS[status] ?? "pending";
}

type Field = {
  key: "status" | "amount" | "route" | "solver" | "created";
  render: (item: FeedItem, now: number) => ReactNode;
};

const FIELDS: readonly Field[] = [
  { key: "status", render: (i) => <IntentStatusBadge status={toBadgeStatus(i.status)} /> },
  { key: "amount", render: (i) => `${i.srcAmount} ${i.srcToken}` },
  { key: "route", render: (i) => `${i.srcChain} → ${i.dstToken}` },
  { key: "solver", render: (i) => i.solver },
  { key: "created", render: (i, now) => timeAgo(i.createdAt, now) },
];

/** Read-only side-by-side view of the selected intents' key fields. */
export function IntentComparePanel({ intents }: { intents: readonly FeedItem[] }) {
  const { t } = useTranslation();
  const now = useLiveRelativeTime();
  const shown = intents.slice(0, MAX_COMPARE_INTENTS);

  return (
    <section aria-labelledby="intent-compare-title" className="card p-4 space-y-3">
      <h2 id="intent-compare-title" className="eyebrow text-xs">
        {t("explore.compare.title")}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{t("explore.compare.caption")}</caption>
          <thead>
            <tr className="border-b border-vx-border">
              <th scope="col" className="px-3 py-2 text-left font-normal text-vx-muted">
                <span className="sr-only">{t("explore.compare.field")}</span>
              </th>
              {shown.map((item, index) => (
                <th key={item.id} scope="col" className="px-3 py-2 text-left font-normal text-vx-text">
                  {t("explore.compare.column", { index: index + 1 })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((field) => (
              <tr key={field.key} className="border-b border-vx-line">
                <th scope="row" className="px-3 py-2 text-left font-normal text-vx-muted whitespace-nowrap">
                  {t(`explore.compare.field.${field.key}`)}
                </th>
                {shown.map((item) => (
                  <td key={item.id} className="num px-3 py-2 text-vx-text break-all">
                    {field.render(item, now)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
