// Shared presentational helpers for /papertrading (server + client safe).
// No data logic here — pure display.

export function fmtUsd(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`glass noise-overlay rounded-[2rem] p-5 transition-colors duration-300 hover:border-[#ccff00]/25 sm:p-6 ${className}`}
    >
      <p className="tech-label mb-4 text-white/40">{title}</p>
      {children}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "neutral"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-[#ccff00]/10 text-[#ccff00]",
    warn: "bg-rose-500/10 text-rose-400",
    neutral: "bg-white/10 text-white/50",
  };
  return <span className={`rounded-full px-2.5 py-0.5 font-mono-tech text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

/** Thin meter bar with an optional reference marker. Pure presentation. */
export function Meter({
  pct,
  markerPct,
  tone = "lime",
}: {
  pct: number;
  markerPct?: number;
  tone?: "lime" | "rose";
}) {
  const fill = tone === "lime" ? "bg-[#ccff00]" : "bg-rose-400";
  return (
    <div className="relative h-1.5 overflow-visible rounded-full bg-white/10">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${clamp(pct)}%` }} />
      {markerPct != null && (
        <div
          className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-white/70"
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
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 font-mono-tech text-xs font-bold text-white/60">
          {n}
        </span>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}
