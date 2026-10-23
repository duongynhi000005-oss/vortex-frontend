"use client";
import { useEffect, useRef, useState } from "react";
import type { ReviewModel } from "@/lib/xdrReview";
import { parseAmountToStroops } from "@/lib/decimal";

/** What the user asked for in the flow that built the transaction. */
export type ExpectedPayment = { asset?: string; amount?: string; destination?: string };

const normalizeAsset = (asset: string) => asset.replace(/\s*\(native\)$/i, "").trim().toUpperCase();

/** Compares in stroops so decimal-precision differences don't false-positive; allows 1 stroop of rounding. */
function amountsMatch(actual: string, expected: string): boolean {
  const a = parseAmountToStroops(actual);
  const e = parseAmountToStroops(expected);
  if (a === null || e === null) return false;
  const diff = a > e ? a - e : e - a;
  return diff <= BigInt(1);
}

/** Returns indexes of payment operations that don't match the expected intent. */
export function findIntentMismatches(review: ReviewModel, expected?: ExpectedPayment): number[] {
  if (!expected) return [];
  const mismatches: number[] = [];
  review.operations.forEach((operation, index) => {
    if (operation.kind !== "payment") return;
    if (
      (expected.asset !== undefined && normalizeAsset(operation.asset) !== normalizeAsset(expected.asset)) ||
      (expected.amount !== undefined && !amountsMatch(operation.amount, expected.amount)) ||
      (expected.destination !== undefined && operation.destination !== expected.destination)
    ) mismatches.push(index);
  });
  return mismatches;
}

export function TransactionReviewModal({ review, open, onConfirm, onCancel, expected }: { review: ReviewModel | null; open: boolean; onConfirm: () => void; onCancel: () => void; expected?: ExpectedPayment }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { setAcknowledged(false); setMismatchAcknowledged(false); cancel.current?.focus(); } }, [open]);
  if (!open || !review) return null;
  const mismatches = findIntentMismatches(review, expected);
  const canConfirm = (!review.unknownOperation || acknowledged) && (mismatches.length === 0 || mismatchAcknowledged);
  return <div role="dialog" aria-modal="true" aria-labelledby="transaction-review-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"><div className="mx-auto max-w-lg rounded-xl border border-vx-border bg-vx-panel p-5"><h2 id="transaction-review-title" className="text-lg font-semibold">Review transaction</h2><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>Network</dt><dd>{review.networkPassphrase}</dd><dt>Source account</dt><dd className="truncate">{review.sourceAccount}</dd><dt>Fee</dt><dd>{review.fee} stroops</dd></dl><div className="mt-4 space-y-2">{review.operations.map((operation, index) => <article key={index} className={`rounded border p-3 ${mismatches.includes(index) ? "border-red-500" : "border-vx-border"}`}><h3 className="font-medium">{operation.kind === "payment" ? "Payment" : operation.functionName === "unknown" ? "Unknown operation" : `Contract call: ${operation.functionName}`}</h3>{operation.kind === "payment" ? <p className="text-sm">{operation.amount} {operation.asset} to {operation.destination}</p> : <p className="text-sm">Contract {operation.contractId}; {operation.argCount} arguments</p>}{mismatches.includes(index) && <p role="alert" className="mt-1 text-sm text-red-500">Does not match what you requested: {[expected?.amount, expected?.asset].filter(Boolean).join(" ") || "payment"}{expected?.destination ? ` to ${expected.destination}` : ""}.</p>}</article>)}</div>{review.unknownOperation && <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand this operation could not be decoded.</label>}{mismatches.length > 0 && <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={mismatchAcknowledged} onChange={(event) => setMismatchAcknowledged(event.target.checked)} /> I understand this transaction does not match the amount, asset, or recipient I requested, and I still want to sign it.</label>}<div className="mt-5 flex justify-end gap-2"><button type="button" ref={cancel} onClick={onCancel} className="rounded border px-3 py-2">Cancel</button><button type="button" disabled={!canConfirm} onClick={onConfirm} className="rounded bg-vx-sage px-3 py-2 disabled:opacity-50">Confirm and sign</button></div></div></div>;
}
