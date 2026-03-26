import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
