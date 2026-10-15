// Primitif UI bersama area produk (/app): kartu, badge status semantik,
// empty/error/loading states, header halaman, metrik, field form, stepper.
// Server-component-safe (tanpa hooks) kecuali dinyatakan lain.
// Warna status: netral = info, teal/hijau = sehat, clay = error/loss,
// amber = warning, sky = info sekunder. Warna tidak pernah tanpa label.

import Link from "next/link";
import type { ReactNode } from "react";
import LogoMark from "./LogoMark";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl tracking-tight text-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-success/15 text-success",
  active: "bg-success/15 text-success",
  healthy: "bg-success/15 text-success",
  stopped: "bg-elevated text-muted",
  paused: "bg-elevated text-muted",
  created: "bg-info/15 text-info",
  ready: "bg-info/15 text-info",
  failed: "bg-danger/15 text-danger",
  error: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  paper: "bg-accent/15 text-accent",
  backtest_only: "bg-elevated text-muted",
  draft: "bg-elevated text-muted",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        STATUS_STYLES[status] ?? "bg-elevated text-muted"
      }`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const tones = {
    neutral: "text-primary",
    good: "text-success",
    bad: "text-danger",
    warn: "text-warning",
  } as const;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold tabular-nums sm:text-4xl ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <p className="tech-label text-muted">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-on-action transition hover:bg-accent-hover"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title, body, retryHref }: { title: string; body: string; retryHref?: string }) {
  return (
    <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-8 text-center" role="alert">
      <p className="tech-label text-danger">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-secondary">{body}</p>
      {retryHref && (
        <Link
          href={retryHref}
          className="mt-4 inline-block rounded-full border border-control-border px-6 py-2.5 text-sm text-secondary hover:text-primary"
        >
          Try again
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-surface ${className}`} />;
}

// ErrorShell — the frame shared by app/error.tsx and app/not-found.tsx.
//
// Deliberately does NOT reuse SiteShell: that fetches Supabase for the nav, and
// an error page that fetches data fails the same way it was reporting. This
// shell is static, so it renders even when the thing that broke is the backend.
export function ErrorShell({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-primary">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="font-display text-lg">TrendSentry</span>
          </div>
          <span className="tech-label hidden text-muted sm:block">{eyebrow}</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>

      <footer className="border-t border-line px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="tech-label text-muted">
            READ-ONLY EXCHANGE ACCESS&nbsp; · &nbsp;NO CUSTODY&nbsp; · &nbsp;NO ORDER PATH
          </p>
          <p className="text-xs text-muted">© 2026 TrendSentry — not financial advice</p>
        </div>
      </footer>
    </div>
  );
}

export function FormField({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted">{help}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={now ? "step" : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-action text-on-action"
                  : now
                    ? "border border-accent/50 text-accent"
                    : "border border-line text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-xs ${now ? "font-medium text-primary" : "text-muted"}`}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Alert({ tone, children }: { tone: "info" | "warn" | "error"; children: ReactNode }) {
  const tones = {
    info: "border-info/25 bg-info/[0.06] text-info",
    warn: "border-warning/25 bg-warning/[0.06] text-warning",
    error: "border-danger/25 bg-danger/[0.06] text-danger",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
