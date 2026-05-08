import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  /**
   * /properties/* リダイレクト（INDUSTRY 切替）
   *
   * INDUSTRY=base（汎用）の場合: /properties → /objects/properties
   *   properties をカスタムオブジェクトとして扱い、汎用ルートへ転送する。
   * INDUSTRY=real-estate の場合: リダイレクト無効
   *   src/app/(crm)/properties/* の専用ページが描画される
   *   （proxy 経由で src/industries/real-estate/pages/properties/* へ委譲）。
   *
   * 業種ごとに `/properties` の振る舞いを切り替えるため、ビルド時に
   * NEXT_PUBLIC_INDUSTRY を読んでリダイレクト配列を生成する。
   */
  async redirects() {
    if (process.env.NEXT_PUBLIC_INDUSTRY === 'real-estate') return []
    return [
      // /properties/new は :id と競合するので先に定義
      {
        source:      '/properties/new',
        destination: '/objects/properties/new',
        permanent:   false,
      },
      // /properties/:id/edit
      {
        source:      '/properties/:id/edit',
        destination: '/objects/properties/:id/edit',
        permanent:   false,
      },
      // /properties/:id（詳細ページ）
      {
        source:      '/properties/:id',
        destination: '/objects/properties/:id',
        permanent:   false,
      },
      // /properties（一覧）
      {
        source:      '/properties',
        destination: '/objects/properties',
        permanent:   false,
      },
    ]
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 開発中はOFF
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
})(nextConfig);
