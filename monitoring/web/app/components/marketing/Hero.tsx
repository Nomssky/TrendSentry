// Hero: editorial centered — headline, proof panel kurva equity asli, CTA.
// Numbers come from the static backtest reference (read-only, no DB).
// Curve = equity-curve.json (downsample mingguan, run canonical 2026-10-02).

import { BACKTEST_REFERENCE } from "@/lib/reference";
import CURVE from "@/lib/equity-curve.json";
import { GhostButton, NeonButton, TechLabel } from "./ui";

function buildPath(points: { equity: number }[]): { line: string; area: string } {
  const W = 600;
  const H = 190;
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - 12 - ((v - min) / span) * (H - 24);
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return { line, area };
}

function ProofPanel() {
  const { line, area } = buildPath(CURVE.points);
  return (
    <div className="glass noise-overlay overflow-hidden rounded-[2rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 sm:px-8">
        <span className="tech-label text-white/50">CLUSTER-A2 // 6Y BACKTEST</span>
        <span className="tech-label flex items-center gap-2 text-[#ccff00]">
          <span className="pulse-dot inline-block h-[6px] w-[6px] rounded-full bg-[#ccff00]" />
          CANONICAL
        </span>
      </div>
      <div className="px-2 pt-4 sm:px-4">
        <svg viewBox="0 0 600 190" className="h-56 w-full sm:h-72" preserveAspectRatio="none" aria-label="Backtest equity curve">
          <path d={area} fill="#ccff00" opacity="0.08" />
          <path d={line} fill="none" stroke="#f3efe6" strokeWidth="2" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-6 border-t border-white/10 px-6 py-5 sm:grid-cols-4 sm:px-8">
        <div>
          <p className="tech-label text-white/40">6Y RETURN</p>
          <p className="font-mono-tech text-2xl font-bold text-[#ccff00] sm:text-3xl">
            +{BACKTEST_REFERENCE.totalReturnPct}%
          </p>
        </div>
        <div>
          <p className="tech-label text-white/40">MAX DD</p>
          <p className="font-mono-tech text-2xl font-bold sm:text-3xl">{BACKTEST_REFERENCE.maxDrawdownPct}%</p>
        </div>
        <div>
          <p className="tech-label text-white/40">SHARPE</p>
          <p className="font-mono-tech text-2xl font-bold sm:text-3xl">{BACKTEST_REFERENCE.sharpeRatio}</p>
        </div>
        <div>
          <p className="tech-label text-white/40">ENTRY RULE</p>
          <p className="font-mono-tech text-2xl font-bold sm:text-3xl">DON 20</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 bg-black/30 px-6 py-3 sm:px-8">
        <span className="tech-label text-white/50">SIGNAL <span className="text-[#ccff00]">LONG_ENTRY // CLOSE &gt; HIGH 20</span></span>
        <span className="tech-label text-white/50">STOP LOSS <span className="text-white">ENTRY − 2×ATR</span></span>
        <span className="tech-label text-white/50">EXIT <span className="text-white">CLOSE &lt; LOW 10</span></span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative px-5 pb-16 pt-12 sm:px-10 sm:pt-16 lg:px-16">
      <div className="mx-auto max-w-4xl text-center">
        <TechLabel className="mb-6 inline-block rounded-full border border-[#ccff00]/30 bg-[#ccff00]/[0.07] px-4 py-1.5 text-[#ccff00]">
          [ QUANT // DISCIPLINE LAYER ]
        </TechLabel>
        <h1
          className="font-bold leading-[0.85] tracking-[-0.06em]"
          style={{ fontSize: "clamp(3.5rem, 8vw, 7.5rem)" }}
        >
          YOUR STRATEGY,
          <br />
          <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">
            NO DEVIATION.
          </span>
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg text-white/60">
          Connect your Bitget exchange. TrendSentry logs every trade you take, flags when you step
          outside your plan, and simulates what discipline would have earned you. No emotion, no FOMO,
          no deviation.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <NeonButton href="/start">Track your discipline →</NeonButton>
          <GhostButton href="/proof">See the proof</GhostButton>
        </div>
        <p className="tech-label mt-8 text-white/30">
          BITGET // READ-ONLY API // FREE TIER OPEN // NO SIGNAL SELLING
        </p>
      </div>
      <div className="mx-auto mt-14 max-w-6xl">
        <ProofPanel />
      </div>
    </section>
  );
}
