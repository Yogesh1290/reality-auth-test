import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Turbopack to correctly resolve @realitylimit/core subpath exports
  // (/browser and /server) during production builds on Vercel
  transpilePackages: ["@realitylimit/core"],
};

export default nextConfig;
