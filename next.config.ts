import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // If you are using baseHref or trailingSlash, add them here
  trailingSlash: true,
};

export default nextConfig;
