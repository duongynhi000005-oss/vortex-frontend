"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS, onStorageChange, storage } from "@/lib/storage";
import type { GovernanceProposal } from "@/lib/governanceStore";
import {
  DEFAULT_REMINDER_WINDOW_HOURS,
  collectProposalEvents,
  type ProposalEvent,
  type ProposalSubscription,
} from "@/lib/notifications/proposalReminders";
import { decideChannels } from "@/lib/notifications/dispatcher";
import { useNotificationPreferences } from "@/store/notificationPreferences";

const KEY = STORAGE_KEYS.proposalSubscriptions.key;
const CHECK_INTERVAL_MS = 60_000;

export function readSubscriptions(): ProposalSubscription[] {
  const parsed = storage.getJSON<ProposalSubscription[]>(KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function writeSubscriptions(subs: ProposalSubscription[]): void {
  if (subs.length === 0) storage.removeItem(KEY);
  else storage.setJSON(KEY, subs);
}

/**
 * Subscribe/unsubscribe to a proposal and surface due reminders while the tab
 * is open. Quiet hours are honoured via the dispatcher's `decideChannels`.
 */
export function useProposalSubscriptions(proposal: GovernanceProposal | null | undefined, address: string | null) {
  const [subs, setSubs] = useState<ProposalSubscription[]>([]);
  const [reminders, setReminders] = useState<ProposalEvent[]>([]);
  const prefs = useNotificationPreferences();

  useEffect(() => {
    setSubs(readSubscriptions());
    return onStorageChange(() => setSubs(readSubscriptions()));
  }, []);

  const proposalId = proposal?.id;
  const isSubscribed = !!proposalId && !!address && subs.some((s) => s.proposalId === proposalId && s.address === address);

  const toggle = useCallback(() => {
    if (!proposal || !address) return;
    const current = readSubscriptions();
    const exists = current.some((s) => s.proposalId === proposal.id && s.address === address);
    const next = exists
      ? current.filter((s) => !(s.proposalId === proposal.id && s.address === address))
      : [
          ...current,
          { proposalId: proposal.id, address, lastStatus: proposal.status, windowHours: DEFAULT_REMINDER_WINDOW_HOURS },
        ];
    writeSubscriptions(next);
    setSubs(next);
    if (exists) setReminders([]);
  }, [proposal, address]);

  useEffect(() => {
    if (!proposal || !address || !isSubscribed) return;
    const check = () => {
      const now = Date.now();
      const current = readSubscriptions();
      const sub = current.find((s) => s.proposalId === proposal.id && s.address === address);
      if (!sub) return;
      const events = collectProposalEvents(sub, proposal, now);
      if (events.length === 0) return;
      const decision = decideChannels({
        prefs,
        status: "accepted",
        visible: true,
        isLeader: true,
        permission: "unsupported",
        now: new Date(now),
      });
      writeSubscriptions(
        current.map((s) =>
          s === sub
            ? { ...s, lastStatus: proposal.status, deadlineNotified: s.deadlineNotified || events.some((e) => e.kind === "deadline") }
            : s,
        ),
      );
      // Toast channel disabled means the user opted out of in-app reminders.
      if (decision.toast) setReminders((prev) => [...prev, ...events]);
    };
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [proposal, address, isSubscribed, prefs]);

  return { isSubscribed, toggle, reminders };
}
