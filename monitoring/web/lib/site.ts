// Single source of truth for public site links & positioning copy.
// Frontend is a read-only display layer (AGENTS.md #9): no trading logic here,
// only static constants + build-time backtest reference from lib/reference.ts.

export const SITE = {
  name: "TrendSentry",
  tagline: "Discipline execution for systematic crypto trading.",
  description:
    "TrendSentry runs your strategy, logs every decision, and holds you accountable — no emotion, no deviation, no FOMO.",
  github: "https://github.com/Nomssky/TrendSentry",
  liveDashboard: "/papertrading",
  realAccount: "/live",
  dashboardExternal: "https://trendsentry.vercel.app/papertrading",
  decisionLog:
    "https://github.com/Nomssky/TrendSentry/blob/main/backtest/reports/decision_log.md",
  // TODO: replace with real waitlist form URL (Tally/Typeform) when W3 starts.
  // Until then every waitlist CTA scrolls to an on-page section / pricing anchor.
  waitlistAnchor: "/pricing#waitlist",
  contactAnchor: "/pricing#waitlist",
} as const;

export const NAV_LINKS = [
  { href: "/proof", label: "Proof" },
  { href: "/live", label: "Live" },
  { href: "/papertrading", label: "Paper" },
  { href: "/pricing", label: "Pricing" },
  { href: "/disclaimer", label: "Risk" },
] as const;
