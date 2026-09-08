// Hero: 12-col split — giant type left, floating glass mockup right.
// Numbers come from the static backtest reference (read-only, no DB).

import { BACKTEST_REFERENCE } from "@/lib/reference";
import { SITE } from "@/lib/site";
import { GhostButton, NeonButton, TechLabel } from "./ui";

function Mockup() {
  return (
    <div className="relative">
      <div className="glass noise-overlay rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="tech-label text-white/50">CLUSTER-A2 // PAPER</span>
          <span className="tech-label flex items-center gap-2 text-[#ccff00]">
            <span className="pulse-dot inline-block h-[6px] w-[6px] rounded-full bg-[#ccff00]" />
            LIVE
          </span>
        </div>
        {/* stylized equity bars, derived from reference return profile */}
        <div className="flex h-40 items-end gap-1.5 sm:h-48">
          {[22, 30, 26, 38, 34, 48, 42, 56, 50, 64, 58, 74, 68, 84, 78, 96].map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-t-md ${i >= 12 ? "bg-[#ccff00]" : "bg-white/15"}`}
            />
          ))}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
          <div>
            <p className="tech-label text-white/40">6Y RETURN</p>
            <p className="font-mono-tech text-2xl font-bold text-[#ccff00]">
              +{BACKTEST_REFERENCE.totalReturnPct}%
            </p>
          </div>
          <div className="text-right">
            <p className="tech-label text-white/40">MAX DD</p>
            <p className="font-mono-tech text-2xl font-bold">{BACKTEST_REFERENCE.maxDrawdownPct}%</p>
          </div>
          <div className="text-right">
            <p className="tech-label text-white/40">SHARPE</p>
            <p className="font-mono-tech text-2xl font-bold">0.82</p>
          </div>
        </div>
      </div>

      <div className="float-anim absolute -left-4 top-8 rounded-2xl border border-white/10 bg-[#0c0c0c]/90 px-4 py-3 backdrop-blur-xl sm:-left-8">
        <p className="tech-label text-white/40">SIGNAL</p>
        <p className="font-mono-tech text-sm font-bold text-[#ccff00]">LONG_ENTRY // BTC</p>
      </div>
      <div
        className="float-anim absolute -right-3 bottom-16 rounded-2xl border border-white/10 bg-[#0c0c0c]/90 px-4 py-3 backdrop-blur-xl sm:-right-6"
        style={{ animationDelay: "-3s" }}
      >
        <p className="tech-label text-white/40">STOP LOSS</p>
        <p className="font-mono-tech text-sm font-bold">ENTRY − 2×ATR</p>
      </div>
      <div className="absolute -top-4 right-10 rounded-full bg-[#ccff00] px-3 py-1 font-mono-tech text-[10px] font-bold uppercase tracking-[0.2em] text-black">
        ✦ AI CURSOR
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative px-5 pb-16 pt-32 sm:px-10 sm:pt-40 lg:px-16">
      <div className="grid grid-cols-12 items-center gap-10">
        <div className="col-span-12 lg:col-span-7">
          <TechLabel className="mb-6 inline-block rounded-full border border-[#ccff00]/30 bg-[#ccff00]/5 px-4 py-1.5">
            [ AI-AUGMENTED // DISCIPLINE LAYER ]
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
          <p className="mt-8 max-w-xl text-lg text-white/60">
            Connect your Bitget exchange. TrendSentry logs every trade you take, flags when you step
            outside your plan, and simulates what discipline would have earned you. No emotion, no FOMO,
            no deviation.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <NeonButton href="/start">Track your discipline →</NeonButton>
            <GhostButton href="/proof">See the proof</GhostButton>
          </div>
          <p className="tech-label mt-8 text-white/30">
            BITGET // READ-ONLY API // FREE TIER OPEN // NO SIGNAL SELLING
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <Mockup />
        </div>
      </div>
    </section>
  );
}
