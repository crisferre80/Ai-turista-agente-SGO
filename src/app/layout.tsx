import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaInstall from '@/components/PwaInstall';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A3A6C" />
        <link rel="apple-touch-icon" href="/santi-avatar.png" />
        {/* WebXR Meta Tags */}
        <meta name="xr-spatial-tracking" content="enabled" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
