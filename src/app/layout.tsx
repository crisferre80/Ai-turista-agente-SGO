import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// mapbox GL CSS globally to prevent runtime warning
import 'mapbox-gl/dist/mapbox-gl.css';
import PwaInstall from '@/components/PwaInstall';
import ThreeLoadingGuards from '@/components/ThreeLoadingGuards';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sant IA Go",
  description: "Tu asistente turístico virtual",
  icons: {
    icon: '/santi-avatar.png',
    apple: '/santi-avatar.png'
  }
};

import { headers } from 'next/headers';
import { LanguageProvider } from '@/i18n/LanguageProvider';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // detect preferred locale from Accept-Language header (server-side)
  const hdrs = await headers();
  // turbopack may return a plain object instead of Headers instance
  const accept = (typeof hdrs.get === 'function'
    ? hdrs.get('accept-language')
    : (hdrs as unknown as Record<string,string>)['accept-language']) || '';
  let serverLocale: 'es' | 'en' | 'pt' | 'fr' = 'es';
  if (accept) {
    const primary = accept.split(',')[0].trim().slice(0, 2);
    if (['es', 'en', 'pt', 'fr'].includes(primary)) {
      serverLocale = primary as 'es' | 'en' | 'pt' | 'fr';
    }
  }

  return (
    <html lang={serverLocale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A3A6C" />
        <link rel="apple-touch-icon" href="/santi-avatar.png" />
        {/* WebXR Meta Tags */}
        <meta name="xr-spatial-tracking" content="enabled" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LanguageProvider initialLocale={serverLocale}>
          <ThreeLoadingGuards />
          {children}
          <PwaInstall />
        </LanguageProvider>
      </body>
    </html>
  );
}
