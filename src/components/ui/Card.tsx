import clsx from "clsx";
import { forwardRef, type HTMLAttributes } from "react";

export type CardVariant = "default" | "sm";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `default` maps to the `.card` surface, `sm` to the denser `.card-sm`. */
  variant?: CardVariant;
}

const VARIANT: Record<CardVariant, string> = {
  default: "card",
  sm: "card-sm",
};

/** Surface container. Reuses the existing `.card` / `.card-sm` component classes. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx(VARIANT[variant], className)} {...rest} />;
});
