// Site wrapper: full-bleed black, content max-width invisible (no card chrome).
// Used by landing and all trust pages for one consistent system.

import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Nav } from "./Nav";
import ScrollBackdrop from "../ScrollBackdrop";
import { createClient } from "@/lib/supabase/server";

export async function SiteShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-black text-[#ebebeb]">
      <ScrollBackdrop />
      <div className="noise-overlay relative">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="glow-sphere left-[-10%] top-[-5%] h-[480px] w-[480px] bg-[#ccff00]/10" />
        <div className="glow-sphere bottom-[10%] right-[-8%] h-[420px] w-[420px] bg-[#10b981]/10" />
        <div className="relative mx-auto w-full max-w-[1600px]">
          <Nav isLoggedIn={!!user} />
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
