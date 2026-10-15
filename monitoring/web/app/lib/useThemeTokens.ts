"use client";

// Resolves design tokens to concrete colour strings for consumers that cannot
// take a CSS declaration — SVG presentation attributes (stroke=, fill=) and
// Recharts inline style objects. Neither resolves `var()`: a presentation
// attribute is parsed as an SVG value, not as CSS.
//
// The point is one source of truth. Chart colours read `--color-success` here
// rather than repeating a hex that would silently drift out of sync with
// globals.css on the next palette change.
//
// getSnapshot must return a cached reference (React compares with Object.is),
// so results are memoised on the active theme. The theme is part of the key
// because the pre-paint script sets it without firing THEME_EVENT.

import { useCallback, useSyncExternalStore } from "react";
import { THEME_EVENT } from "./theme";

const SERVER: Record<string, string> = {};

let cacheKey = "";
let cache: Record<string, string> = SERVER;

function readTokens(key: string): Record<string, string> {
  const theme = document.documentElement.getAttribute("data-theme") ?? "light";
  const full = `${theme}:${key}`;
  if (full === cacheKey) return cache;

  const cs = getComputedStyle(document.documentElement);
  const next: Record<string, string> = {};
  for (const name of key.split(",")) {
    next[name] = cs.getPropertyValue(`--color-${name}`).trim();
  }
  cacheKey = full;
  cache = next;
  return cache;
}

export function useThemeTokens(names: string[]): Record<string, string> {
  // Serialising makes this a stable dependency without asking callers to
  // memoise the array they pass in.
  const key = names.join(",");

  const subscribe = useCallback((cb: () => void) => {
    document.addEventListener(THEME_EVENT, cb);
    return () => document.removeEventListener(THEME_EVENT, cb);
  }, []);

  const getSnapshot = useCallback(() => readTokens(key), [key]);

  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}