import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  /**
   * /properties/* → /objects/properties/* へのリダイレクト
   *
   * properties テーブルのデータは custom_records へ移行済み。
   * 旧 URL へのブックマーク・外部リンクを安全に転送する。
   * permanent: false（302）にすることで将来の変更に対応できる。
   */
  async redirects() {
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
