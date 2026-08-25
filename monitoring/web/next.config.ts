import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: hasil build = folder out/ (HTML murni), cocok untuk Vercel Hobby.
  // Data di-bake saat build dari db/paper_trading.db (di-commit bot tiap hari ->
  // tiap commit = redeploy = dashboard refresh harian).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
