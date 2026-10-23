import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid: rose border plus `aria-invalid="true"`. */
  invalid?: boolean;
}

/**
 * Shared text input primitive. Uses logical padding (`ps-`/`pe-`) so the
 * field mirrors correctly in RTL documents.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        "w-full ps-3 pe-3 py-2 text-sm bg-vx-surface text-vx-text placeholder:text-vx-muted rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage disabled:opacity-60 disabled:cursor-not-allowed",
        invalid ? "border-vx-rose" : "border-vx-border",
        className,
      )}
      {...rest}
    />
  );
});
