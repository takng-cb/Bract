import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  /**
   * /properties/* と /vehicles/* リダイレクト（INDUSTRY 切替）
   *
   * - INDUSTRY=real-estate: /properties は overlay 専用ルートへ。
   *   /vehicles は base と同じく /objects/vehicles へ転送（auto-body 用なので不在）。
   * - INDUSTRY=auto-body:   /vehicles は overlay 専用ルートへ。
   *   /properties は base と同じく /objects/properties へ転送。
   * - INDUSTRY=base:        両方ともカスタムオブジェクトの汎用ルートへ転送。
   *
   * 業種ごとに振る舞いを切り替えるため、ビルド時に NEXT_PUBLIC_INDUSTRY を
   * 読んでリダイレクト配列を生成する。
   */
  async redirects() {
    const industry = process.env.NEXT_PUBLIC_INDUSTRY
    const rules: { source: string; destination: string; permanent: boolean }[] = []

    // properties: real-estate のみ overlay。それ以外は /objects/properties へ
    if (industry !== 'real-estate') {
      rules.push(
        { source: '/properties/new',      destination: '/objects/properties/new',       permanent: false },
        { source: '/properties/:id/edit', destination: '/objects/properties/:id/edit',  permanent: false },
        { source: '/properties/:id',      destination: '/objects/properties/:id',       permanent: false },
        { source: '/properties',          destination: '/objects/properties',           permanent: false },
      )
    }

    // vehicles / parts: auto-body のみ overlay。それ以外は /objects/* へ
    if (industry !== 'auto-body') {
      rules.push(
        { source: '/vehicles/new',      destination: '/objects/vehicles/new',      permanent: false },
        { source: '/vehicles/:id/edit', destination: '/objects/vehicles/:id/edit', permanent: false },
        { source: '/vehicles/:id',      destination: '/objects/vehicles/:id',      permanent: false },
        { source: '/vehicles',          destination: '/objects/vehicles',          permanent: false },
        { source: '/parts/new',         destination: '/objects/parts/new',         permanent: false },
        { source: '/parts/:id/edit',    destination: '/objects/parts/:id/edit',    permanent: false },
        { source: '/parts/:id',         destination: '/objects/parts/:id',         permanent: false },
        { source: '/parts',             destination: '/objects/parts',             permanent: false },
      )
    }

    return rules
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 開発中はOFF
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
})(nextConfig);
