"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { IntentComparePanel, MAX_COMPARE_INTENTS, toBadgeStatus } from "@/components/IntentComparePanel";
import IntentStatusBadge from "@/components/IntentStatusBadge";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

type ColumnId = "intent" | "status" | "route" | "solver" | "created";

export default function ExplorePageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error } = useLiveIntents();
  const now = useLiveRelativeTime();
  // Selection lives here, not in DataTable, so it survives virtualised scrolling.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const selected = useMemo(
    () => intents.filter((item) => selectedKeys.includes(item.id)),
    [intents, selectedKeys],
  );
  const canCompare = selected.length >= 2;

  const columns: DataTableColumn<FeedItem, ColumnId>[] = [
    {
      id: "intent",
      header: t("explore.table.intent"),
      isRowHeader: true,
      cell: (i) => `${i.srcAmount} ${i.srcToken} → ${i.dstToken}`,
    },
    {
      id: "status",
      header: t("explore.table.status"),
      cell: (i) => <IntentStatusBadge status={toBadgeStatus(i.status)} />,
    },
    { id: "route", header: t("explore.table.route"), cell: (i) => `${i.srcChain} → ${i.dstToken}` },
    { id: "solver", header: t("explore.table.solver"), cell: (i) => i.solver },
    { id: "created", header: t("explore.table.created"), cell: (i) => timeAgo(i.createdAt, now) },
  ];

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("explore.title")} />
      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-6">
        <h1 className="text-lg sm:text-2xl font-bold text-vx-text">{t("explore.title")}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-vx-muted" aria-live="polite">
            {canCompare
              ? t("explore.selectionCount", { count: selected.length, max: MAX_COMPARE_INTENTS })
              : t("explore.selectHint", { max: MAX_COMPARE_INTENTS })}
          </p>
          {canCompare && (
            <button
              type="button"
              onClick={() => setComparing((open) => !open)}
              aria-expanded={comparing}
              className="rounded-lg border border-vx-border px-3 py-1.5 text-xs text-vx-text hover:bg-vx-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {comparing ? t("explore.compare.close") : t("explore.compareSelected", { count: selected.length })}
            </button>
          )}
        </div>

        {canCompare && comparing && <IntentComparePanel intents={selected} />}

        {error ? (
          <p role="alert" className="text-xs text-vx-amber">
            {t("explore.error")}
          </p>
        ) : isLoading && intents.length === 0 ? (
          <div className="card p-6 h-40 animate-pulse" aria-busy="true" />
        ) : intents.length === 0 ? (
          <p className="text-xs text-vx-muted">{t("explore.empty")}</p>
        ) : (
          <DataTable
            caption={t("explore.table.caption")}
            columns={columns}
            rows={intents}
            getRowKey={(i) => i.id}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            selectionLimit={MAX_COMPARE_INTENTS}
            selectionLabels={{
              column: t("explore.table.select"),
              row: (i) => t("explore.table.selectRow", { intent: `${i.srcAmount} ${i.srcToken} → ${i.dstToken}` }),
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
