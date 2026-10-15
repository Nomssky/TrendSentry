// Shared presentational helpers for /papertrading (server + client safe).
// No data logic here — pure display.

export function fmtUsd(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`glass noise-overlay rounded-[2rem] p-5 transition-colors duration-300 hover:border-accent/25 sm:p-6 ${className}`}
    >
      <p className="tech-label mb-4 text-muted">{title}</p>
      {children}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "neutral"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-accent/10 text-accent",
    warn: "bg-danger/10 text-danger",
    neutral: "bg-elevated text-muted",
  };
  return <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

/** Thin meter bar with an optional reference marker. Pure presentation. */
export function Meter({
  pct,
  markerPct,
  tone = "accent",
}: {
  pct: number;
  markerPct?: number;
  tone?: "accent" | "danger";
}) {
  const fill = tone === "accent" ? "bg-accent" : "bg-danger";
  return (
    <div className="relative h-1.5 overflow-visible rounded-full bg-elevated">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${clamp(pct)}%` }} />
      {markerPct != null && (
        <div
          className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-muted"
          style={{ left: `${clamp(markerPct)}%` }}
          title="reference"
        />
      )}
    </div>
  );
}

export function SectionHead({ n, title, right }: { n: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line font-mono text-xs font-bold text-secondary">
          {n}
        </span>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}
