import type { NextConfig } from "next";

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
        ],
      },
    ]
  },
};

export default nextConfig;
