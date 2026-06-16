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

// インストール時/モバイルのブラウザ上部バー色をブランド（Sage Deep）に統一（manifest.json と一致）
export const viewport: Viewport = {
  themeColor: "#5E7C5A",
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
      suppressHydrationWarning
    >
      <head>
        {/* テーマ初期適用（REQ-0079）。描画前に cookie からブランド色＋ライト/ダークを
            <html> に反映して FOUC を防ぐ。cookie 形式は `${color}:${mode}`。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )bract_theme=([^;]+)/);var v=m?decodeURIComponent(m[1]):'';var p=v.split(':');var c=p[0]||'green';var mode=p[1]||'system';var d=document.documentElement;if(c&&c!=='green')d.setAttribute('data-theme',c);else d.removeAttribute('data-theme');var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',dark);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SwUnregister />
        {children}
      </body>
    </html>
  );
}
