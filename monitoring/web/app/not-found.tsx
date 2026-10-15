// app/not-found.tsx — 404 for any unmatched route.
//
// Static by design: no Supabase call, so a 404 still renders when the backend
// is the thing that is down. Mirrors the approved "Not Found 404" board.

import Link from "next/link";
import { ErrorShell } from "./components/ui";

const ALWAYS_WORKS = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/strategies", label: "Strategies" },
  { href: "/app/deployments", label: "Deployments" },
  { href: "/app/deviation-log", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
];

export default function NotFound() {
  return (
    <ErrorShell eyebrow="404 · not-found.tsx">
      <div>
        {/* Solid, not ghosted. The approved board sets the 404 in ink at full
            strength so the numeral carries the hierarchy — dimming it to
            carry "secondary" weight instead would drop it under the 3:1
            large-text threshold. Size alone does that job here. */}
        <p className="font-display text-7xl leading-none tracking-[-0.04em] sm:text-8xl">
          404
        </p>

        <h1 className="mt-6 font-display text-3xl tracking-tight sm:text-4xl">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-3 text-lg text-secondary">
          The link may be out of date, or the page may have moved.
        </p>
        <p className="mt-2 text-sm text-muted">
          Nothing was deleted — your strategies and history are safe.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/dashboard"
            className="rounded-full bg-action px-7 py-3 text-sm font-medium text-on-action transition hover:bg-action/90"
          >
            Back to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-full border border-control-border px-7 py-3 text-sm text-secondary transition hover:border-line-strong hover:text-primary"
          >
            Go to homepage
          </Link>
        </div>

        <div className="mt-12">
          <p className="tech-label text-muted">LOOKING FOR SOMETHING? THESE ALWAYS WORK:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ALWAYS_WORKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block rounded-full border border-control-border bg-surface px-4 py-2 text-sm text-secondary transition hover:border-line-strong hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ErrorShell>
  );
}