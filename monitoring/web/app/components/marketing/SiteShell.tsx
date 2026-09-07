// Floating-shell site wrapper: black viewport + rounded obsidian container.
// Used by landing and all W2 trust pages for one consistent system.

import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black px-2 py-2 sm:px-4 sm:py-4">
      <div className="noise-overlay relative mx-auto max-w-[1600px] overflow-hidden rounded-[2.5rem] bg-[#0c0c0c] shadow-2xl ring-1 ring-white/10">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="glow-sphere left-[-10%] top-[-5%] h-[480px] w-[480px] bg-[#ccff00]/10" />
        <div className="glow-sphere bottom-[10%] right-[-8%] h-[420px] w-[420px] bg-[#10b981]/10" />
        <div className="relative">
          <Nav />
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
