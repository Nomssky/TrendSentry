// Site wrapper: kanvas penuh, konten max-width tanpa chrome kartu.
// Dipakai landing dan semua halaman trust supaya satu sistem konsisten.
//
// Tidak ada grid-bg / glow-sphere lagi: dua dekorasi itu milik tema neon
// lama dan tidak ada di desain editorial yang baru. Noise-overlay + hairline
// ScrollBackdrop sudah cukup kedalaman tanpa cahaya blooming.

import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Nav } from "./Nav";
import ScrollBackdrop from "../ScrollBackdrop";
import { createClient } from "@/lib/supabase/server";

export async function SiteShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <ScrollBackdrop />
      <div className="noise-overlay relative">
        <div className="relative mx-auto w-full max-w-[1600px]">
          <Nav isLoggedIn={!!user} />
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
