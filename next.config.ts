import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles the build output — no need for "standalone" output.
  // Strict type checking is enforced for production safety.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
