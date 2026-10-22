'use client';

import type { ReactNode } from 'react';

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Pins a single primary call-to-action to the bottom of the viewport on
 * narrow (mobile) widths so it stays reachable without scrolling back up.
 * On `sm:` and wider it renders inline exactly where it is placed.
 *
 * Respects iOS safe-area insets via `env(safe-area-inset-bottom)`.
 */
export default function StickyActionBar({ children, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:border-t max-sm:border-gray-200 max-sm:bg-white/95 max-sm:px-4 max-sm:pt-3 max-sm:backdrop-blur dark:max-sm:border-gray-700 dark:max-sm:bg-gray-900/95 ${className}`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}
