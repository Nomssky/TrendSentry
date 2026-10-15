// Theme switching. Shared by the toggle, the chart token reader, and (as an
// inlined copy of THEME_KEY) the pre-paint script in ThemeScript.tsx.
//
// The key literal is duplicated in ThemeScript on purpose: that script has to
// run before any module is loaded, so it cannot import from here. If you rename
// THEME_KEY, update ThemeScript.tsx too — nothing enforces it at build time.

export const THEME_KEY = "ts-theme";
export const THEME_EVENT = "ts-theme-change";

export type Theme = "light" | "dark";

/** Writes the attribute, persists, and tells token readers to re-resolve. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode: the theme still applies for this page view, it just will
    // not be remembered. Not worth breaking navigation over.
  }
  document.dispatchEvent(new Event(THEME_EVENT));
}

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/** What the document currently shows, including a stored-but-not-yet-applied one. */
export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return readStoredTheme() ?? "light";
}