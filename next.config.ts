import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Removed 'output: export' to enable API routes
};

export default nextConfig;
