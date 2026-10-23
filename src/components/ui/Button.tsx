import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Shows a spinner, sets `aria-busy="true"` and disables the button so the
   * action cannot be triggered twice while it is in flight.
   */
  loading?: boolean;
}

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg select-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage focus-visible:ring-offset-2 focus-visible:ring-offset-vx-card disabled:opacity-60 disabled:cursor-not-allowed";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-vx-sage text-vx-ink hover:brightness-110",
  secondary:
    "border border-vx-border bg-vx-surface text-vx-text hover:border-vx-sage/30 hover:text-vx-sage",
  ghost: "text-vx-muted hover:text-vx-text hover:bg-vx-sage-bg",
  danger: "bg-vx-rose text-vx-ink hover:brightness-110",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

/**
 * Shared button primitive. Disabled buttons use the native `disabled`
 * attribute so they leave the tab order; use `aria-disabled` on a custom
 * element only when the control must stay focusable.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(BASE, VARIANT[variant], SIZE[size], className)}
      {...rest}
    >
      {loading && (
        <svg aria-hidden="true" className="w-3.5 h-3.5 animate-spin flex-shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
          <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
});
