import type { NextConfig } from "next";

// CSP: sengaja longgar pada script/style inline karena Next.js menyuntikkan
// bootstrap & style inline (Tailwind/recharts). Yang penting di sini adalah
// membatasi asal koneksi & frame. domain supabase diambil dari env agar tidak
// hardcode. `connect-src` termasuk api.bitget.com (tidak dipakai browser,
// tapi aman untuk dev).
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin} https://api.bitget.com`,
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Standalone HANYA untuk image Docker (deploy/Dockerfile.web set DOCKER_BUILD=1).
  // Vercel melakukan tracing sendiri — standalone di sana meledak (ENOENT .nft.json).
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: paksa HTTPS. Vercel sudah set ini default; eksplisit untuk konsistensi.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ]
  },
};

export default nextConfig;
