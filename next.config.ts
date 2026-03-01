import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gcoptrxyfjmekdtxuqns.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Internationalization is handled via our custom LanguageProvider in the App Router
  // (next.config.ts i18n is unsupported when using the app/ directory).
  // Keep locale list in sync with src/i18n/translations.ts if you add/remove languages.
  // Removed 'output: export' to enable API routes
};

export default nextConfig;
