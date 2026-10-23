"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToastStore, type Toast, type ToastVariant } from "@/store/toast";

const SWIPE_DISMISS_THRESHOLD = 80;

const variantStyles: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  error:
    "border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  info: "border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    startXRef.current = event.clientX;
    pointerIdRef.current = event.pointerId;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null || pointerIdRef.current !== event.pointerId) return;
    setOffsetX(event.clientX - startXRef.current);
  }, []);

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null || pointerIdRef.current !== event.pointerId) return;
      const delta = event.clientX - startXRef.current;
      startXRef.current = null;
      pointerIdRef.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (Math.abs(delta) >= SWIPE_DISMISS_THRESHOLD) {
        onDismiss(toast.id);
      } else {
        setOffsetX(0);
      }
    },
    [onDismiss, toast.id],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss(toast.id);
      }
    },
    [onDismiss, toast.id],
  );

  const reducedMotion = prefersReducedMotion();
  const role = toast.variant === "error" ? "alert" : "status";
  const opacity = dragging ? Math.max(0.4, 1 - Math.abs(offsetX) / 200) : 1;

  return (
    <div
      role={role}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 ${variantStyles[toast.variant]}`}
      style={{
        transform: `translateX(${offsetX}px)`,
        opacity,
        transition: dragging || reducedMotion ? "none" : "transform 150ms ease, opacity 150ms ease",
        touchAction: "pan-y",
      }}
    >
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-1 text-current/70 outline-none transition hover:text-current focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    // no-op: keeps subscription stable across renders
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}
