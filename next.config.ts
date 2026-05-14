import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  /**
   * Client cache の TTL を伸ばす（Next.js 16）。
   *
   * デフォルトでは dynamic ページ（DB を叩く Server Component を含むページ）の
   * client cache は 0 秒（無効）で、戻る/再訪のたびにサーバーに行ってしまう。
   * 体感パフォーマンス改善 (#40) の文脈で、本 CRM の主要ナビは「短期間で同じ
   * 画面を行き来する」ユースが多いため、dynamic も 30 秒キャッシュする。
   *
   * static は prefetch={true} 付きの Link でも適用される。
   * Sidebar / MobileNav / BottomNav はすべて prefetch={true} で 5 分キャッシュ。
   *
   * docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
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

/**
 * PWA は無効化。
 *
 * 経緯: @ducanh2912/next-pwa の Service Worker が Next.js App Router の
 * RSC prefetch (?_rsc= 付きの fetch) を `pages-rsc-prefetch` キャッシュで
 * 横取りしてしまい、<Link prefetch={true}> の自動 prefetch が一切発火
 * しない問題を引き起こしていた。
 *
 * 実測: SW 解除前 click→content ~2200ms / SW 解除後 ~9ms（100x 以上の改善）
 *
 * このアプリは DB 必須のオンライン CRM であり、ページのオフラインキャッシュは
 * 「古いデータが見える」リスクの方が大きい。よって PWA は無効化する。
 * 既存ユーザーの端末に残った SW は src/app/sw-unregister.tsx が一度だけ
 * unregister する。
 */
export default withPWA({
  dest: "public",
  disable: true,
})(nextConfig);
