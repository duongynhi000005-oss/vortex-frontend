import type { FeedItem } from "@/lib/types";
import type { GovernanceProposal } from "@/lib/governanceStore";

export type ProposalSubscription = {
  proposalId: string;
  address: string;
  /** Status seen at subscribe/last check; a change triggers a transition event. */
  lastStatus: GovernanceProposal["status"];
  /** Reminder window before the deadline, in hours. */
  windowHours: number;
  /** Set once the deadline reminder fired so it is not repeated. */
  deadlineNotified?: boolean;
};

export const DEFAULT_REMINDER_WINDOW_HOURS = 24;

export type ProposalEvent = { kind: "deadline" | "status"; item: FeedItem; message: string };

/** True when the deadline is in the future and within `windowHours`. */
export function isWithinDeadlineWindow(deadline: string, windowHours: number, now: number): boolean {
  const ends = Date.parse(deadline);
  if (Number.isNaN(ends)) return false;
  const remaining = ends - now;
  return remaining > 0 && remaining <= windowHours * 3_600_000;
}

/** Builds FeedItem-shaped payloads that `decideChannels` can consume. */
export function collectProposalEvents(
  sub: ProposalSubscription,
  proposal: GovernanceProposal,
  now: number,
): ProposalEvent[] {
  const events: ProposalEvent[] = [];
  const base = {
    id: `${proposal.id}`,
    srcAmount: "",
    srcToken: proposal.title,
    dstToken: "",
  };
  if (proposal.status !== sub.lastStatus) {
    events.push({
      kind: "status",
      item: { ...base, status: "accepted" } as unknown as FeedItem,
      message: `${proposal.id} is now ${proposal.status}`,
    });
  }
  if (
    !sub.deadlineNotified &&
    proposal.status === "active" &&
    isWithinDeadlineWindow(proposal.deadline, sub.windowHours, now)
  ) {
    events.push({
      kind: "deadline",
      item: { ...base, status: "accepted" } as unknown as FeedItem,
      message: `Voting on ${proposal.id} closes ${new Date(proposal.deadline).toUTCString()}`,
    });
  }
  return events;
}
