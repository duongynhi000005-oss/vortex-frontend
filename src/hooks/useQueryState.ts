import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write URL query parameters (same pattern as the explore page). Empty
 * strings and `null` remove the key so default state keeps a clean URL.
 * `push` adds a history entry (so the browser back button steps back);
 * the default `replace` does not.
 */
export function useQueryState() {
  let router: ReturnType<typeof useRouter> | null = null;
  let pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  let searchParams: URLSearchParams;
  try {
    router = useRouter();
    pathname = usePathname() ?? pathname;
    const sp = useSearchParams();
    searchParams = sp ?? new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  } catch {
    searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  }

  const update = useCallback(
    (updates: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (router) {
        if (mode === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      } else if (typeof window !== "undefined") {
        if (mode === "push") window.history.pushState(null, "", href);
        else window.history.replaceState(null, "", href);
      }
    },
    [router, pathname, searchParams],
  );

  return { params: searchParams, update };
}
