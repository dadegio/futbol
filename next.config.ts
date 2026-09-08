import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/api/leagues/:leagueId/overview",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=30, stale-while-revalidate=90" },
        ],
      },
      {
        source: "/api/leagues/:leagueId/table",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/leagues/:leagueId/sponsors",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/api/leagues/:leagueId/media",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=60, stale-while-revalidate=180" },
        ],
      },
      {
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
