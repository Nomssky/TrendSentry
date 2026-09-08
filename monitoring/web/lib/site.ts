// Single source of truth for public site links & positioning copy.
// Frontend is a read-only display layer (AGENTS.md #9): no trading logic here,
// only static constants + build-time backtest reference from lib/reference.ts.

export const SITE = {
  name: "TrendSentry",
  tagline: "Your strategy, executed without deviation.",
  description:
    "TrendSentry auto-logs your trades, detects when you deviate from your plan, and shows what discipline is worth — in your own data.",
  github: "https://github.com/Nomssky/TrendSentry",
  liveDashboard: "/papertrading",
  realAccount: "/live",
  dashboardExternal: "https://trendsentry.vercel.app/papertrading",
  decisionLog:
    "https://github.com/Nomssky/TrendSentry/blob/main/backtest/reports/decision_log.md",
  waitlistAnchor: "/start",
  contactAnchor: "/start",
} as const;

export const NAV_LINKS = [
  { href: "/start", label: "Start" },
  { href: "/proof", label: "Proof" },
  { href: "/live", label: "Live" },
  { href: "/papertrading", label: "Paper" },
  { href: "/pricing", label: "Pricing" },
] as const;
