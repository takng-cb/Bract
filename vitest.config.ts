/**
 * Vitest 設定。
 *
 * - 対象: src 配下の `*.test.ts` / `*.test.tsx`
 * - 環境: Node（ロジック層の純粋関数テスト中心。
 *   将来 React コンポーネントのテストを書くなら environment を 'jsdom' に切替）
 * - エイリアス: tsconfig.json の `paths` に合わせて `@/*` → `./src/*` を解決
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    reporters: 'default',
  },
})
