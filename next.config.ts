import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  experimental: {
    authInterrupts: true,
  },
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing.html",
      },
    ];
  },
};

export default nextConfig;
