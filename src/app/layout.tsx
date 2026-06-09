import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import SwUnregister from "./sw-unregister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 和文（Noto Sans JP）。CJK は大きいため preload せず、必要時に読み込む。
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
});

// インストール時/モバイルのブラウザ上部バー色をブランドグリーンに統一（manifest.json と一致）
export const viewport: Viewport = {
  themeColor: "#187a4e",
};

export const metadata: Metadata = {
  title: "Bract CRM",
  description: "社内CRMシステム",
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SwUnregister />
        {children}
      </body>
    </html>
  );
}
