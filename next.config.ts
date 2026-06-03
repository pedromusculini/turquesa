import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed swcMinify and compress as they are not recognized in NextConfig for Next 16
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],

  typescript: { ignoreBuildErrors: false },

  /** Alias do painel admin (Prompt A) até renomear pastas em app/. */
  async rewrites() {
    return [
      { source: "/painel-turque-agenda", destination: "/naomexaaquiseucorno" },
      { source: "/painel-turque-agenda/:path*", destination: "/naomexaaquiseucorno/:path*" },
      {
        source: "/api/painel-turque-agenda/:path*",
        destination: "/api/naomexaaquiseucorno/:path*",
      },
    ];
  },
};

export default nextConfig;