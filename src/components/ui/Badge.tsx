import clsx from "clsx";
import type { HTMLAttributes } from "react";

export type BadgeTone = "neutral" | "sage" | "lav" | "amber" | "rose";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-vx-surface text-vx-muted border-vx-border",
  sage: "bg-vx-sage-bg text-vx-sage border-vx-sage/20",
  lav: "bg-vx-lav-bg text-vx-lav border-vx-lav/20",
  amber: "bg-vx-surface text-vx-amber border-vx-border",
  rose: "bg-vx-surface text-vx-rose border-vx-border",
};

/** Small status label. Matches the `.chip` token shape from globals.css. */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
