"use client"

// Theme state lives outside React: the pre-paint script writes
// <html data-theme> before the bundle loads, and localStorage holds the choice.
// useSyncExternalStore is the primitive for reading an external store like
// this — a mount effect + setState would be a cascading render, and would also
// put the toggle's icon a frame behind the actual surface.
//
// Hydration: React uses getServerSnapshot while hydrating, then re-reads with
// getSnapshot. So the server renders the light icon, and it corrects to the
// saved theme before the browser paints — no flash, and no mismatch warning
// (<html> carries suppressHydrationWarning because the script mutates it).

import { useCallback, useSyncExternalStore } from "react";
import { applyTheme, THEME_EVENT, type Theme } from "@/app/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const subscribe = useCallback((cb: () => void) => {
    document.addEventListener(THEME_EVENT, cb);
    return () => document.removeEventListener(THEME_EVENT, cb);
  }, []);

  const getSnapshot = useCallback(
    () =>
      document.documentElement.getAttribute("data-theme") === "dark"
        ? ("dark" as Theme)
        : ("light" as Theme),
    [],
  );

  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);
  const isDark = theme === "dark";

  const toggle = () => applyTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      // One control, action stated — not two competing toggles.
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-secondary transition-colors hover:border-accent hover:text-accent ${className}`}
    >
      {/* Sun/moon are decorative; the accessible name carries the meaning. */}
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        {isDark ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9 9 0 0 0 8.354-5.646Z"
          />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path
              strokeLinecap="round"
              d="M12 2v2m0 16v2M4.929 4.929l1.414 1.414m11.314 11.314 1.414 1.414M2 12h2m16 0h2M4.929 19.071l1.414-1.414M17.657 6.343l1.414-1.414"
            />
          </>
        )}
      </svg>
    </button>
  );
}