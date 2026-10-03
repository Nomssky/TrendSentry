// Primitif UI bersama area produk (/app): kartu, badge status semantik,
// empty/error/loading states, header halaman, metrik, field form, stepper.
// Server-component-safe (tanpa hooks) kecuali dinyatakan lain.
// Warna status: netral = info, lime/hijau = sehat, rose = error/loss,
// amber = warning, sky = info sekunder. Warna tidak pernah tanpa label.

import Link from "next/link";
import type { ReactNode } from "react";

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
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-white/50">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-400",
  active: "bg-emerald-500/15 text-emerald-400",
  healthy: "bg-emerald-500/15 text-emerald-400",
  stopped: "bg-white/10 text-white/50",
  paused: "bg-white/10 text-white/50",
  created: "bg-sky-500/15 text-sky-400",
  ready: "bg-sky-500/15 text-sky-400",
  failed: "bg-rose-500/15 text-rose-400",
  error: "bg-rose-500/15 text-rose-400",
  warning: "bg-amber-500/15 text-amber-400",
  paper: "bg-[#ccff00]/15 text-[#ccff00]",
  backtest_only: "bg-white/10 text-white/50",
  draft: "bg-white/10 text-white/40",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        STATUS_STYLES[status] ?? "bg-white/10 text-white/50"
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
    neutral: "text-white",
    good: "text-emerald-400",
    bad: "text-rose-400",
    warn: "text-amber-400",
  } as const;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 font-mono-tech text-3xl font-bold tabular-nums sm:text-4xl ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
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
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <p className="tech-label text-white/40">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/50">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-full bg-[#ccff00] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-[#aadd00]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title, body, retryHref }: { title: string; body: string; retryHref?: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-8 text-center" role="alert">
      <p className="tech-label text-rose-400">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">{body}</p>
      {retryHref && (
        <Link
          href={retryHref}
          className="mt-4 inline-block rounded-full border border-white/15 px-6 py-2.5 text-sm text-white/80 hover:text-white"
        >
          Try again
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
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
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
        {label}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-white/35">{help}</p>}
      {error && (
        <p className="mt-1 text-xs text-rose-400" role="alert">
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
                  ? "bg-[#ccff00] text-black"
                  : now
                    ? "border border-[#ccff00]/60 text-[#ccff00]"
                    : "border border-white/15 text-white/35"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-xs ${now ? "font-medium text-white" : "text-white/40"}`}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-white/15" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Alert({ tone, children }: { tone: "info" | "warn" | "error"; children: ReactNode }) {
  const tones = {
    info: "border-sky-500/25 bg-sky-500/[0.06] text-sky-200",
    warn: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200",
    error: "border-rose-500/25 bg-rose-500/[0.06] text-rose-200",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
