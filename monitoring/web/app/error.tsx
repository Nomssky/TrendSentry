"use client";

// app/error.tsx — root error boundary.
//
// Deliberately fetches nothing. This is the boundary that catches a failed
// Supabase call or a thrown render, so anything here that touches the network
// fails the same way it is reporting. Layout is static; `reset()` re-renders the
// segment without a full reload.

import { useEffect } from "react";
import Link from "next/link";
import { ErrorShell } from "./components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle support has on a server-side render failure.
    console.error("[app/error]", error.digest ?? "no-digest", error);
  }, [error]);

  const reference = error.digest
    ? `TS-${new Date().toISOString().slice(0, 10)}-${error.digest.slice(0, 6)}`
    : null;

  return (
    <ErrorShell eyebrow="SOMETHING WENT WRONG">
      <div role="alert">
        <div
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-2xl bg-danger/10 text-4xl text-danger"
        >
          !
        </div>

        <h1 className="mt-8 font-display text-3xl tracking-tight sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-lg text-secondary">We couldn&apos;t load this page.</p>
        <p className="mt-2 text-sm text-muted">
          Your strategies, keys and trade history are untouched.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-action px-7 py-3 text-sm font-medium text-on-action transition hover:bg-action/90"
          >
            Try again
          </button>
          <Link
            href="/app/dashboard"
            className="rounded-full border border-control-border px-7 py-3 text-sm text-secondary transition hover:border-line-strong hover:text-primary"
          >
            Go to dashboard
          </Link>
        </div>

        {reference && (
          <div className="mt-10 rounded-2xl border border-line bg-surface p-5">
            <p className="tech-label text-muted">REFERENCE FOR SUPPORT</p>
            <p className="mt-2 font-mono text-sm text-secondary">{reference}</p>
            <p className="mt-2 text-xs text-muted">
              Share this code if it keeps happening.
            </p>
          </div>
        )}
      </div>
    </ErrorShell>
  );
}